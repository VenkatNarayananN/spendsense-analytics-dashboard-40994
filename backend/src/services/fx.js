const DEFAULT_BASE = 'USD';
const OPEN_EXCHANGE_RATES_BASE_URL = 'https://openexchangerates.org/api';

/**
 * We keep a small allowlist for input validation. Open Exchange Rates itself supports more currencies,
 * but the product requirement asked for “known ISO codes (e.g., USD, EUR, GBP, INR)”.
 */
const ALLOWED_BASES = new Set(['USD', 'EUR', 'GBP', 'INR']);

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
  const apiKey = process.env.OPEN_EXCHANGE_RATES_API_KEY;
  if (!apiKey) {
    const err = new Error('Missing required environment variable OPEN_EXCHANGE_RATES_API_KEY.');
    err.code = 'MISSING_API_KEY';
    throw err;
  }

  // Node 18+ has fetch globally. This template may be running on Node 18 in CI/runtime.
  // If not, we'd add a dependency, but we avoid that unless necessary.
  const url = new URL(`${OPEN_EXCHANGE_RATES_BASE_URL}/latest.json`);
  url.searchParams.set('app_id', apiKey);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    const err = new Error(`Open Exchange Rates upstream error: HTTP ${response.status}`);
    err.code = 'UPSTREAM_HTTP_ERROR';
    err.status = response.status;
    err.upstreamBody = bodyText;
    throw err;
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

module.exports = {
  validateBase,
  fetchLatestRates,
  ALLOWED_BASES,
  DEFAULT_BASE,
};

