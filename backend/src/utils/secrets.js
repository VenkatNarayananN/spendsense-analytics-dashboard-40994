'use strict';

/**
 * Utilities for preventing accidental secret leakage in logs/errors.
 */

function _escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * PUBLIC_INTERFACE
 * Masks a secret string so it can be safely included in logs.
 * @param {string} secret
 * @returns {string}
 */
function maskSecret(secret) {
  if (!secret || typeof secret !== 'string') return '';
  const s = secret.trim();
  if (s.length <= 4) return '****';
  return `${s.slice(0, 2)}****${s.slice(-2)}`;
}

/**
 * PUBLIC_INTERFACE
 * Redacts the configured Open Exchange Rates key from an arbitrary string.
 * @param {string} text
 * @returns {string}
 */
function redactOpenExchangeRatesKey(text) {
  if (!text || typeof text !== 'string') return text;

  const key = process.env.OPEN_EXCHANGE_RATES_API_KEY;
  if (!key || typeof key !== 'string') return text;

  const safeKey = key.trim();
  if (!safeKey) return text;

  return text.replace(new RegExp(_escapeRegExp(safeKey), 'g'), maskSecret(safeKey));
}

/**
 * PUBLIC_INTERFACE
 * Converts an error to a log-safe string and redacts known secrets.
 * @param {unknown} err
 * @returns {string}
 */
function toSafeErrorString(err) {
  let msg = '';
  if (err instanceof Error) {
    msg = err.stack || err.message || String(err);
  } else if (typeof err === 'string') {
    msg = err;
  } else {
    try {
      msg = JSON.stringify(err);
    } catch {
      msg = String(err);
    }
  }
  return redactOpenExchangeRatesKey(msg);
}

module.exports = {
  maskSecret,
  redactOpenExchangeRatesKey,
  toSafeErrorString,
};
