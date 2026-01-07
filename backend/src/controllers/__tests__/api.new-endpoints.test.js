const request = require('supertest');

/**
 * New endpoints tests:
 * - Mock auth middleware so req.user exists
 * - Mock pg pool for deterministic results
 *
 * These are unit-ish API tests against the express app with dependency injection via jest.doMock.
 */

describe('New API endpoints (transactions, analytics, alerts, users/me)', () => {
  beforeEach(() => {
    jest.resetModules();

    // Mock auth to attach user id
    jest.doMock('../../middleware', () => ({
      requireSupabaseAuth: () => (req, res, next) => {
        req.user = { sub: 'user-123' };
        return next();
      },
      errorHandler: require('../../middleware/errorHandler').errorHandler,
      requestLogger: () => (req, res, next) => next(),
      createRateLimiter: () => (req, res, next) => next(),
    }));
  });

  test('GET /api/users/me returns 200 with user object', async () => {
    jest.doMock('../../db/pool', () => ({
      getPool: () => ({
        query: jest
          .fn()
          // upsert users
          .mockResolvedValueOnce({ rows: [] })
          // select user
          .mockResolvedValueOnce({
            rows: [{ id: 'user-123', name: 'Alex', avatar_url: null, created_at: null, updated_at: null }],
          }),
      }),
      healthCheck: jest.fn(),
    }));

    const app = require('../../app');
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toHaveProperty('user');
    expect(res.body.data.user).toMatchObject({ id: 'user-123', name: 'Alex' });
  });

  test('PUT /api/users/me validates empty payload (400)', async () => {
    jest.doMock('../../db/pool', () => ({
      getPool: () => ({
        query: jest.fn(),
      }),
      healthCheck: jest.fn(),
    }));

    const app = require('../../app');
    const res = await request(app)
      .put('/api/users/me')
      .set('Authorization', 'Bearer test-token')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
  });

  test('GET /api/transactions returns 200 with items + page', async () => {
    jest.doMock('../../db/pool', () => ({
      getPool: () => ({
        query: jest
          .fn()
          // count
          .mockResolvedValueOnce({ rows: [{ total: 2 }] })
          // list
          .mockResolvedValueOnce({
            rows: [
              { id: 't1', user_id: 'user-123', amount: 10, currency: 'USD', category: 'Food', merchant: 'A', occurred_at: '2025-01-01T00:00:00Z' },
              { id: 't2', user_id: 'user-123', amount: 20, currency: 'USD', category: 'Food', merchant: 'B', occurred_at: '2025-01-02T00:00:00Z' },
            ],
          }),
      }),
      healthCheck: jest.fn(),
    }));

    const app = require('../../app');
    const res = await request(app)
      .get('/api/transactions?limit=10&offset=0')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toHaveProperty('items');
    expect(res.body.data).toHaveProperty('page');
    expect(res.body.data.page).toMatchObject({ limit: 10, offset: 0, total: 2 });
  });

  test('POST /api/transactions validates missing fields (400)', async () => {
    jest.doMock('../../db/pool', () => ({
      getPool: () => ({ query: jest.fn() }),
      healthCheck: jest.fn(),
    }));

    const app = require('../../app');
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', 'Bearer test-token')
      .send({ amount: 10 });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
  });

  test('GET /api/analytics/summary returns 200 with summary', async () => {
    jest.doMock('../../db/pool', () => ({
      getPool: () => ({
        query: jest
          .fn()
          // totals
          .mockResolvedValueOnce({ rows: [{ total_spend: 30, min_date: '2025-01-01T00:00:00Z', max_date: '2025-01-02T00:00:00Z', count: 2 }] })
          // top categories
          .mockResolvedValueOnce({ rows: [{ category: 'Food', total: 30 }] })
          // recent merchants
          .mockResolvedValueOnce({ rows: [{ merchant: 'A' }, { merchant: 'B' }] }),
      }),
      healthCheck: jest.fn(),
    }));

    const app = require('../../app');
    const res = await request(app)
      .get('/api/analytics/summary')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toHaveProperty('summary');
    expect(res.body.data.summary).toHaveProperty('total_spend', 30);
    expect(res.body.data.summary).toHaveProperty('top_categories');
  });

  test('GET /api/alerts returns 200 with items', async () => {
    jest.doMock('../../db/pool', () => ({
      getPool: () => ({
        query: jest.fn().mockResolvedValueOnce({ rows: [{ id: 'a1', user_id: 'user-123', type: 'budget', message: 'hi', status: 'active' }] }),
      }),
      healthCheck: jest.fn(),
    }));

    const app = require('../../app');
    const res = await request(app)
      .get('/api/alerts')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data.items).toHaveLength(1);
  });

  test('POST /api/alerts validates missing fields (400)', async () => {
    jest.doMock('../../db/pool', () => ({
      getPool: () => ({ query: jest.fn() }),
      healthCheck: jest.fn(),
    }));

    const app = require('../../app');
    const res = await request(app)
      .post('/api/alerts')
      .set('Authorization', 'Bearer test-token')
      .send({ type: 'budget' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body.error).toHaveProperty('code', 'VALIDATION_ERROR');
  });
});
