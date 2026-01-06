'use strict';

const { maskSecret } = require('../utils/secrets');

/**
 * PUBLIC_INTERFACE
 * Runs lightweight startup checks. This is intentionally non-fatal to keep the service running
 * (other endpoints may still be useful), but it emits clear warnings for misconfiguration.
 */
function runStartupChecks() {
  const key = process.env.OPEN_EXCHANGE_RATES_API_KEY;

  if (!key) {
    console.warn(
      '[startup] WARNING: OPEN_EXCHANGE_RATES_API_KEY is not set. GET /api/fx/latest will return an error until configured.'
    );
    return;
  }

  // Never log the raw key, even in debug.
  console.log(`[startup] FX provider key detected: ${maskSecret(String(key))}`);
}

module.exports = {
  runStartupChecks,
};
