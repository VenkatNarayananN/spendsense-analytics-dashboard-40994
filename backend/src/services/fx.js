const DEFAULT_BASE = 'USD';
const OPEN_EXCHANGE_RATES_BASE_URL = 'https://openexchangerates.org/api';

/**
 * We keep a small allowlist for input validation. Open Exchange Rates itself supports more currencies,
 * but the product requirement asked for “known ISO codes (e.g., USD, EUR, GBP, INR)”.
 */
const ALLOWED_BASES = new Set(['USD', 'EUR', 'GBP', 'INR']);

/**
 * In-memory cache keyed by requested base currency.
 * This intentionally stays module-scoped (process memory) and uses no external dependencies.
 *
 * Shape:
 *  {
 *    [base]: { payload: object, cachedAtMs: number }
 *  }
 */
const _latestRatesCacheByBase = Object.create(null);

const LATEST_RATES_CACHE_TTL_SECONDS = 3600;
const LATEST_RATES_CACHE_TTL_MS = LATEST_RATES_CACHE_TTL_SECONDS * 1000;

/**
 * PUBLIC_INTERFACE
 * Validate/normalize a base currency code.
 * @param {unknown} base Raw base query param.
 * @returns {{ ok: true, base: string } | { ok: false, message: string }}
 */
function validateBase(base) {
  if (base === undefined || base === null || base === '') {
    return { ok: true, base: DEFAULT_BASE };
  }

  if (typeof base !== 'string') {
    return { ok: false, message: 'Query param "base" must be a string ISO currency code.' };
  }

  const normalized = base.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(normalized)) {
    return { ok: false, message: 'Query param "base" must be a 3-letter ISO currency code (e.g., USD).' };
  }

  if (!ALLOWED_BASES.has(normalized)) {
    return {
      ok: false,
      message: `Unsupported base currency "${normalized}". Supported: ${Array.from(ALLOWED_BASES).join(', ')}.`,
    };
  }

  return { ok: true, base: normalized };
}

/**
 * Internal helper to read cache entry (if any) for base.
 * @param {string} base
 * @returns {{ payload: any, cachedAtMs: number } | null}
 */
function _getCacheEntry(base) {
  const entry = _latestRatesCacheByBase[base];
  if (!entry || !entry.payload || typeof entry.cachedAtMs !== 'number') {
    return null;
  }
  return entry;
}

/**
 * Internal helper to store cache entry.
 * @param {string} base
 * @param {any} payload
 */
function _setCacheEntry(base, payload) {
  _latestRatesCacheByBase[base] = {
    payload,
    cachedAtMs: Date.now(),
  };
}

/**
 * PUBLIC_INTERFACE
 * Clears the in-memory cache.
 * Intended for tests and diagnostic/admin use only.
 */
function clearCache() {
  for (const key of Object.keys(_latestRatesCacheByBase)) {
    delete _latestRatesCacheByBase[key];
  }
}

/**
 * PUBLIC_INTERFACE
 * Fetch latest FX rates from Open Exchange Rates and normalize them to:
 * { base: string, timestamp: number, rates: { [code: string]: number } }.
 *
 * Notes:
 * - OXR's /latest.json returns rates with a fixed base of USD for free plans.
 * - If a non-USD base is requested, we derive cross rates from the USD rates:
 *     rate(base->X) = rate(USD->X) / rate(USD->base)
 *
 * @param {string} base ISO 4217 base currency code (validated).
 * @returns {Promise<{ base: string, timestamp: number, rates: Record<string, number> }>}
 */
async function fetchLatestRates(base) {
  const { ExternalApiError } = require('../errors/AppError');
  const { redactOpenExchangeRatesKey } = require('../utils/secrets');

  // IMPORTANT: This API key must only ever be read on the server.
  const apiKey = process.env.OPEN_EXCHANGE_RATES_API_KEY;
  if (!apiKey) {
    // Do not include the key value in any errors/logs.
    const err = new Error('Missing required environment variable OPEN_EXCHANGE_RATES_API_KEY.');
    err.code = 'MISSING_API_KEY';
    throw err;
  }

  // Node 18+ has fetch globally. This template may be running on Node 18 in CI/runtime.
  // If not, we'd add a dependency, but we avoid that unless necessary.
  const url = new URL(`${OPEN_EXCHANGE_RATES_BASE_URL}/latest.json`);
  url.searchParams.set('app_id', apiKey);

  let response;
  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
  } catch (cause) {
    // Network/DNS/timeouts etc => treat as upstream failure.
    throw new ExternalApiError({
      service: 'openexchangerates',
      message: 'Unable to fetch exchange rates right now. Please try again later.',
      upstreamStatus: undefined,
      upstreamBody: undefined,
      code: 'OXR_FETCH_FAILED',
    });
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    const safeBody = redactOpenExchangeRatesKey(bodyText);

    throw new ExternalApiError({
      service: 'openexchangerates',
      message: 'Unable to fetch exchange rates right now. Please try again later.',
      upstreamStatus: response.status,
      upstreamBody: safeBody || undefined,
      code: 'OXR_UPSTREAM_ERROR',
    });
  }

  const data = await response.json();

  const upstreamTimestamp = typeof data.timestamp === 'number' ? data.timestamp : Math.floor(Date.now() / 1000);
  const upstreamRates = data && typeof data.rates === 'object' && data.rates ? data.rates : null;

  if (!upstreamRates) {
    const err = new Error('Open Exchange Rates returned an unexpected payload.');
    err.code = 'UPSTREAM_BAD_PAYLOAD';
    throw err;
  }

  // Ensure USD exists in the returned rates (it should be ~1).
  if (typeof upstreamRates.USD !== 'number') {
    upstreamRates.USD = 1;
  }

  // If base is USD, we can return directly.
  if (base === 'USD') {
    return {
      base: 'USD',
      timestamp: upstreamTimestamp,
      rates: upstreamRates,
    };
  }

  const baseRateFromUSD = upstreamRates[base];
  if (typeof baseRateFromUSD !== 'number' || baseRateFromUSD <= 0) {
    const err = new Error(`Upstream rates do not contain a usable rate for base "${base}".`);
    err.code = 'UPSTREAM_MISSING_BASE_RATE';
    throw err;
  }

  // Derive cross rates: base->X = (USD->X) / (USD->base)
  const derivedRates = {};
  for (const [code, usdToCode] of Object.entries(upstreamRates)) {
    if (typeof usdToCode !== 'number') {
      continue;
    }
    derivedRates[code] = usdToCode / baseRateFromUSD;
  }
  derivedRates[base] = 1;

  return {
    base,
    timestamp: upstreamTimestamp,
    rates: derivedRates,
  };
}

/**
 * PUBLIC_INTERFACE
 * Cached version of latest-rates fetch. Caches the *full normalized response* per requested base for 3600 seconds.
 *
 * Behavior:
 * - If a valid cached entry exists: return it (cache: "hit")
 * - If missing/expired cache: fetch upstream, store, return (cache: "miss")
 * - If upstream fetch fails and stale cache exists: return stale cached payload (cache: "stale")
 * - If upstream fetch fails and no stale cache exists: throw the upstream error
 *
 * @param {string} base ISO 4217 base currency code (validated).
 * @returns {Promise<{ payload: { base: string, timestamp: number, rates: Record<string, number> }, cache: 'hit'|'miss'|'stale' }>}
 */
async function fetchLatestRatesCached(base) {
  const entry = _getCacheEntry(base);
  const now = Date.now();

  if (entry) {
    const ageMs = now - entry.cachedAtMs;
    if (ageMs >= 0 && ageMs < LATEST_RATES_CACHE_TTL_MS) {
      return { payload: entry.payload, cache: 'hit' };
    }
  }

  try {
    const payload = await fetchLatestRates(base);
    _setCacheEntry(base, payload);
    return { payload, cache: 'miss' };
  } catch (err) {
    // Upstream failed; if we have any cached value, allow stale fallback.
    if (entry) {
      return { payload: entry.payload, cache: 'stale' };
    }
    throw err;
  }
}

module.exports = {
  validateBase,
  fetchLatestRates,
  fetchLatestRatesCached,
  clearCache,
  ALLOWED_BASES,
  DEFAULT_BASE,
};
