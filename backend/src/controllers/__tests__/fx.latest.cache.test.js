const request = require('supertest');
const app = require('../../app');
const fxService = require('../../services/fx');

describe('GET /api/fx/latest caching', () => {
  beforeEach(() => {
    // Ensure clean slate per test to avoid cross-test cache pollution.
    fxService.clearCache();
    process.env.OPEN_EXCHANGE_RATES_API_KEY = 'test-key';
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
    delete process.env.OPEN_EXCHANGE_RATES_API_KEY;
  });

  test('returns miss then hit for same base, with cache headers', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        timestamp: 1700000000,
        rates: { USD: 1, EUR: 0.9, GBP: 0.8, INR: 80 },
      }),
    });

    const first = await request(app).get('/api/fx/latest?base=USD');
    expect(first.status).toBe(200);
    expect(first.headers['x-cache']).toBe('miss');
    expect(first.headers['cache-control']).toBe('public, max-age=60');
    expect(first.body).toHaveProperty('base', 'USD');
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const second = await request(app).get('/api/fx/latest?base=USD');
    expect(second.status).toBe(200);
    expect(second.headers['x-cache']).toBe('hit');
    expect(second.headers['cache-control']).toBe('public, max-age=60');
    expect(second.body).toHaveProperty('base', 'USD');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('returns stale cached value when upstream fails after cache exists', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        timestamp: 1700000000,
        rates: { USD: 1, EUR: 0.9, GBP: 0.8, INR: 80 },
      }),
    });

    const seed = await request(app).get('/api/fx/latest?base=USD');
    expect(seed.status).toBe(200);
    expect(seed.headers['x-cache']).toBe('miss');

    // Force expiration by moving cached timestamp back in time.
    // (We don't expose cache internals publicly; simplest is to clear and re-seed with an expired entry by monkey-patching Date.now.)
    // Instead, simulate expiration by temporarily overriding Date.now to be > TTL past and then making upstream fail.
    const realNow = Date.now;
    const nowMs = realNow();
    Date.now = () => nowMs + (3600 * 1000) + 1;

    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'upstream error',
    });

    const stale = await request(app).get('/api/fx/latest?base=USD');
    expect(stale.status).toBe(200);
    expect(stale.headers['x-cache']).toBe('stale');
    expect(stale.headers['cache-control']).toBe('public, max-age=60');
    expect(stale.body).toHaveProperty('base', 'USD');

    // Restore Date.now
    Date.now = realNow;
  });

  test('returns 502 when upstream fails and no cache exists (standardized error JSON, no secret leakage)', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      text: async () => `bad gateway app_id=${process.env.OPEN_EXCHANGE_RATES_API_KEY}`,
    });

    const res = await request(app).get('/api/fx/latest?base=USD');
    expect(res.status).toBe(502);

    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toHaveProperty('code');
    expect(res.body.error).toHaveProperty(
      'message',
      'Unable to fetch exchange rates right now. Please try again later.'
    );

    // Ensure the API key is not leaked anywhere in the error payload.
    expect(JSON.stringify(res.body)).not.toContain(process.env.OPEN_EXCHANGE_RATES_API_KEY);
  });
});
