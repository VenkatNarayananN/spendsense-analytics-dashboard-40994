'use strict';

const { Pool } = require('pg');
const { resolveDbConfig } = require('../config/dbConfig');
const { AppError } = require('../errors/AppError');

/** @type {import('pg').Pool | null} */
let _pool = null;

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function _sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run a function with a simple timeout.
 * @template T
 * @param {Promise<T>} promise
 * @param {number} timeoutMs
 * @returns {Promise<T>}
 */
async function _withTimeout(promise, timeoutMs) {
  let timedOut = false;

  const timeout = (async () => {
    await _sleep(timeoutMs);
    timedOut = true;
    throw new Error(`Timed out after ${timeoutMs}ms`);
  })();

  try {
    // eslint-disable-next-line no-undef
    return await Promise.race([promise, timeout]);
  } catch (err) {
    if (timedOut) {
      const e = new AppError(
        'DB_TIMEOUT',
        'Database request timed out.',
        503,
        { cause: err }
      );
      e.isDbError = true;
      throw e;
    }
    throw err;
  }
}

/**
 * PUBLIC_INTERFACE
 * Get (and lazily initialize) the shared pg Pool.
 *
 * NOTE:
 * - This does NOT verify connectivity by itself; use healthCheck() for that.
 * - We never log URLs/passwords in this module.
 *
 * @returns {import('pg').Pool}
 */
function getPool() {
  if (_pool) return _pool;

  const resolved = resolveDbConfig();
  if (!resolved.ok) {
    const err = new AppError(resolved.code, resolved.message, 500);
    err.isDbError = true;
    throw err;
  }

  _pool = new Pool({
    ...resolved.pgConfig,
    // Safe, modest defaults (can be tuned later via env vars if needed)
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  // If the pool emits an error (e.g., broken idle client), log safely.
  _pool.on('error', (err) => {
    console.error(`[db] pool error (idle client): ${err && err.message ? err.message : String(err)}`);
  });

  return _pool;
}

/**
 * PUBLIC_INTERFACE
 * Run a lightweight DB connectivity check: `SELECT 1`.
 *
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<{ ok: true }>}
 */
async function healthCheck(options = {}) {
  const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : 2000;

  try {
    const pool = getPool();
    await _withTimeout(pool.query('SELECT 1'), timeoutMs);
    return { ok: true };
  } catch (err) {
    // Normalize unknown errors to AppError so the error handler keeps a consistent shape.
    if (err instanceof AppError) {
      err.isDbError = true;
      throw err;
    }

    const e = new AppError(
      'DB_UNAVAILABLE',
      'Database is unavailable.',
      503,
      { cause: err }
    );
    e.isDbError = true;
    throw e;
  }
}

module.exports = {
  getPool,
  healthCheck,
};
