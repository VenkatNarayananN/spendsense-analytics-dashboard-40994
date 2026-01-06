const request = require('supertest');
const app = require('../../app');
const fxService = require('../../services/fx');

describe('GET /api/fx/latest should not leak provider API key', () => {
  beforeEach(() => {
    fxService.clearCache();
    process.env.OPEN_EXCHANGE_RATES_API_KEY = 'super-secret-test-key';
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
    delete process.env.OPEN_EXCHANGE_RATES_API_KEY;
  });

  test('response body does not contain OPEN_EXCHANGE_RATES_API_KEY and caching works (miss then hit)', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        timestamp: 1700000000,
        rates: { USD: 1, EUR: 0.9, GBP: 0.8, INR: 80 },
      }),
    });

    const first = await request(app)
      .get('/api/fx/latest?base=USD')
      .set('Authorization', 'Bearer test-token');
    expect(first.status).toBe(200);
    expect(first.headers['x-cache']).toBe('miss');
    expect(JSON.stringify(first.body)).not.toContain(process.env.OPEN_EXCHANGE_RATES_API_KEY);

    const second = await request(app)
      .get('/api/fx/latest?base=USD')
      .set('Authorization', 'Bearer test-token');
    expect(second.status).toBe(200);
    expect(second.headers['x-cache']).toBe('hit');
    expect(JSON.stringify(second.body)).not.toContain(process.env.OPEN_EXCHANGE_RATES_API_KEY);

    // Only one upstream fetch because the second request hits in-memory cache.
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
