'use strict';

/**
 * Database configuration resolution.
 *
 * Priority:
 * 1) Supabase Postgres:
 *   - SUPABASE_DB_URL (preferred, full connection string), OR
 *   - Discrete fields: SUPABASE_DB_HOST, SUPABASE_DB_PORT, SUPABASE_DB_NAME, SUPABASE_DB_USER, SUPABASE_DB_PASSWORD
 *   - SSL defaults ON for Supabase unless explicitly disabled (rare).
 *
 * 2) Local Postgres:
 *   - POSTGRES_URL (full connection string), OR
 *   - Discrete fields: POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD
 *   - SSL defaults OFF for local unless POSTGRES_SSL=true or PGSSLMODE=require or SSL=true
 *
 * SECURITY:
 * - Never log full URLs or passwords.
 */

function _truthy(v) {
  if (v === undefined || v === null) return false;
  const s = String(v).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

function _intOrUndefined(v) {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Derive SSL intent from env vars.
 * We also support PGSSLMODE=require and SSL=true patterns.
 * @param {{ hostedDefault: boolean }} opts
 */
function _resolveSslFromEnv(opts) {
  const pgsslmode = process.env.PGSSLMODE;
  if (pgsslmode && String(pgsslmode).toLowerCase() === 'require') return true;

  const ssl = process.env.SSL;
  if (ssl !== undefined) return _truthy(ssl);

  // For local builds, support explicit POSTGRES_SSL=true
  const postgresSsl = process.env.POSTGRES_SSL;
  if (postgresSsl !== undefined) return _truthy(postgresSsl);

  return Boolean(opts.hostedDefault);
}

/**
 * Build a safe, concise summary for logs.
 * @param {{ target: string, host?: string, port?: number, database?: string, ssl: boolean }} cfg
 * @returns {string}
 */
function _formatSafeSummary(cfg) {
  const host = cfg.host || 'unknown-host';
  const port = cfg.port || 5432;
  const db = cfg.database || 'unknown-db';
  const ssl = cfg.ssl ? 'on' : 'off';
  return `[db] connected target: ${host}:${port}/${db} ssl=${ssl}`;
}

/**
 * Attempt to parse a postgres connection string into safe display values.
 * @param {string} connectionString
 * @returns {{ host?: string, port?: number, database?: string }}
 */
function _parseConnStringForSummary(connectionString) {
  try {
    const u = new URL(connectionString);
    const host = u.hostname || undefined;
    const port = u.port ? _intOrUndefined(u.port) : undefined;
    const database = u.pathname ? u.pathname.replace(/^\//, '') : undefined;
    return { host, port, database };
  } catch {
    return {};
  }
}

/**
 * PUBLIC_INTERFACE
 * Resolve effective database config from environment variables.
 *
 * Returns a pg.Pool config object (either { connectionString, ssl } or { host, port, database, user, password, ssl }).
 * Also returns safe metadata for logging.
 *
 * @returns {{
 *   ok: true,
 *   source: 'supabase'|'local',
 *   pgConfig: any,
 *   summary: { host?: string, port?: number, database?: string, ssl: boolean, target: string },
 *   safeBanner: string
 * } | { ok: false, code: string, message: string }}
 */
function resolveDbConfig() {
  // Supabase URL preferred
  const supabaseUrl = process.env.SUPABASE_DB_URL;
  const hasSupabaseUrl = Boolean(supabaseUrl && String(supabaseUrl).trim());

  const supaHost = process.env.SUPABASE_DB_HOST;
  const supaPort = _intOrUndefined(process.env.SUPABASE_DB_PORT);
  const supaDb = process.env.SUPABASE_DB_NAME;
  const supaUser = process.env.SUPABASE_DB_USER;
  const supaPass = process.env.SUPABASE_DB_PASSWORD;

  const hasSupabaseDiscrete =
    Boolean(supaHost && supaDb && supaUser && supaPass) ||
    // If password is intentionally empty (unlikely), still allow host/db/user to be the gate:
    Boolean(supaHost && supaDb && supaUser && process.env.SUPABASE_DB_PASSWORD !== undefined);

  // Local URL next
  const localUrl = process.env.POSTGRES_URL;
  const hasLocalUrl = Boolean(localUrl && String(localUrl).trim());

  const localHost = process.env.POSTGRES_HOST;
  const localPort = _intOrUndefined(process.env.POSTGRES_PORT);
  const localDb = process.env.POSTGRES_DB;
  const localUser = process.env.POSTGRES_USER;
  const localPass = process.env.POSTGRES_PASSWORD;

  const hasLocalDiscrete =
    Boolean(localHost && localDb && localUser && localPass) ||
    Boolean(localHost && localDb && localUser && process.env.POSTGRES_PASSWORD !== undefined);

  // Determine source
  if (hasSupabaseUrl) {
    const ssl = _resolveSslFromEnv({ hostedDefault: true });
    const parsed = _parseConnStringForSummary(String(supabaseUrl));
    const summary = {
      ...parsed,
      ssl,
      target: 'supabase-url',
    };

    return {
      ok: true,
      source: 'supabase',
      pgConfig: {
        connectionString: String(supabaseUrl),
        ssl: ssl ? { rejectUnauthorized: false } : false,
      },
      summary,
      safeBanner: _formatSafeSummary(summary),
    };
  }

  if (hasSupabaseDiscrete) {
    const ssl = _resolveSslFromEnv({ hostedDefault: true });
    const summary = {
      host: supaHost,
      port: supaPort || 5432,
      database: supaDb,
      ssl,
      target: 'supabase-discrete',
    };

    return {
      ok: true,
      source: 'supabase',
      pgConfig: {
        host: String(supaHost),
        port: supaPort || 5432,
        database: String(supaDb),
        user: String(supaUser),
        password: String(supaPass || ''),
        ssl: ssl ? { rejectUnauthorized: false } : false,
      },
      summary,
      safeBanner: _formatSafeSummary(summary),
    };
  }

  if (hasLocalUrl) {
    const ssl = _resolveSslFromEnv({ hostedDefault: false });
    const parsed = _parseConnStringForSummary(String(localUrl));
    const summary = {
      ...parsed,
      ssl,
      target: 'local-url',
    };

    return {
      ok: true,
      source: 'local',
      pgConfig: {
        connectionString: String(localUrl),
        ssl: ssl ? { rejectUnauthorized: false } : false,
      },
      summary,
      safeBanner: _formatSafeSummary(summary),
    };
  }

  if (hasLocalDiscrete) {
    const ssl = _resolveSslFromEnv({ hostedDefault: false });
    const summary = {
      host: localHost,
      port: localPort || 5432,
      database: localDb,
      ssl,
      target: 'local-discrete',
    };

    return {
      ok: true,
      source: 'local',
      pgConfig: {
        host: String(localHost),
        port: localPort || 5432,
        database: String(localDb),
        user: String(localUser),
        password: String(localPass || ''),
        ssl: ssl ? { rejectUnauthorized: false } : false,
      },
      summary,
      safeBanner: _formatSafeSummary(summary),
    };
  }

  return {
    ok: false,
    code: 'DB_NOT_CONFIGURED',
    message:
      'Database is not configured. Set SUPABASE_DB_URL (preferred) or SUPABASE_DB_* fields; otherwise set POSTGRES_URL or POSTGRES_* fields.',
  };
}

/**
 * PUBLIC_INTERFACE
 * Produce a concise, safe summary of the selected DB target without establishing a connection.
 * @returns {{ ok: true, source: string, banner: string } | { ok: false, code: string, message: string }}
 */
function getDbConfigSummary() {
  const resolved = resolveDbConfig();
  if (!resolved.ok) return resolved;
  return { ok: true, source: resolved.source, banner: resolved.safeBanner };
}

/**
 * PUBLIC_INTERFACE
 * Logs a safe summary of the DB configuration (no secrets).
 * @returns {void}
 */
function logDbConfigSummary() {
  const summary = getDbConfigSummary();
  if (!summary.ok) {
    console.warn(`[db] WARNING: ${summary.code}: ${summary.message}`);
    return;
  }
  console.log(`[db] target selected: source=${summary.source} (details hidden)`);
}

module.exports = {
  resolveDbConfig,
  getDbConfigSummary,
  logDbConfigSummary,
};
