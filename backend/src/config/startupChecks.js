'use strict';

const { maskSecret } = require('../utils/secrets');

/**
 * PUBLIC_INTERFACE
 * Runs lightweight startup checks. This is intentionally non-fatal to keep the service running
 * (other endpoints may still be useful), but it emits clear warnings for misconfiguration.
 */
async function runStartupChecks() {
  const key = process.env.OPEN_EXCHANGE_RATES_API_KEY;

  if (!key) {
    console.warn(
      '[startup] WARNING: OPEN_EXCHANGE_RATES_API_KEY is not set. GET /api/fx/latest will return an error until configured.'
    );
  } else {
    // Never log the raw key, even in debug.
    console.log(`[startup] FX provider key detected: ${maskSecret(String(key))}`);
  }

  // DB checks are non-fatal: service can still run for endpoints that don't need DB.
  try {
    const { logDbConfigSummary } = require('./dbConfig');
    const { healthCheck } = require('../db/pool');

    logDbConfigSummary();

    // First health check => print a single-line connection banner with host/db/ssl but no secrets.
    await healthCheck({ timeoutMs: 2000 });

    const { resolveDbConfig } = require('./dbConfig');
    const resolved = resolveDbConfig();
    if (resolved.ok) {
      console.log(resolved.safeBanner);
    }
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    console.warn(`[startup] WARNING: DB health check failed: ${msg}`);
  }
}

module.exports = {
  runStartupChecks,
};
