const request = require('supertest');

/**
 * Demo seeding tests:
 * - Requires auth (covered in auth.unauthenticated.test.js)
 * - Inserts are scoped to authenticated user
 * - Repeated calls within same day are idempotent (second call returns 0 inserts)
 */
describe('Demo seed endpoint', () => {
  beforeEach(() => {
    jest.resetModules();

    // Mock auth middleware so req.user exists (user-123).
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

  test('POST /api/demo/seed inserts data for caller and returns summary', async () => {
    const query = jest
      .fn()
      // upsert users
      .mockResolvedValueOnce({ rows: [] })
      // tx check (not seeded)
      .mockResolvedValueOnce({ rows: [] })
      // alert check (not seeded)
      .mockResolvedValueOnce({ rows: [] })
      // BEGIN
      .mockResolvedValueOnce({ rows: [] });

    // Add 75 tx inserts + 3 alert inserts + COMMIT
    // We don't need to validate every single call's SQL, but we ensure they use user-123.
    for (let i = 0; i < 75; i += 1) query.mockResolvedValueOnce({ rows: [] });
    for (let i = 0; i < 3; i += 1) query.mockResolvedValueOnce({ rows: [] });
    query.mockResolvedValueOnce({ rows: [] }); // COMMIT

    const connect = jest.fn().mockResolvedValue({
      query,
      release: jest.fn(),
    });

    jest.doMock('../../db/pool', () => ({
      getPool: () => ({ query, connect }),
      healthCheck: jest.fn(),
    }));

    const app = require('../../app');
    const res = await request(app)
      .post('/api/demo/seed')
      .set('Authorization', 'Bearer test-token')
      .send({ count: 75 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      inserted: { transactions: 75, alerts: 3 },
    });

    // Verify inserts are scoped to caller
    // Find at least one transaction insert call and ensure $1 is user-123.
    const insertTxCall = query.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('INSERT INTO transactions')
    );
    expect(insertTxCall).toBeTruthy();
    expect(insertTxCall[1][0]).toBe('user-123');

    const insertAlertCall = query.mock.calls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('INSERT INTO alerts')
    );
    expect(insertAlertCall).toBeTruthy();
    expect(insertAlertCall[1][0]).toBe('user-123');
  });

  test('POST /api/demo/seed is idempotent per user per day', async () => {
    const query = jest
      .fn()
      // upsert users
      .mockResolvedValueOnce({ rows: [] })
      // tx check -> already seeded
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] })
      // (alert check might still run depending on implementation, but current code runs both)
      .mockResolvedValueOnce({ rows: [] });

    jest.doMock('../../db/pool', () => ({
      getPool: () => ({ query, connect: jest.fn() }),
      healthCheck: jest.fn(),
    }));

    const app = require('../../app');
    const res = await request(app)
      .post('/api/demo/seed')
      .set('Authorization', 'Bearer test-token')
      .send({ count: 50 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      inserted: { transactions: 0, alerts: 0 },
    });

    // Ensure we did NOT open a transaction (no connect/BEGIN) when already seeded.
    const anyBegin = query.mock.calls.some((c) => c[0] === 'BEGIN');
    expect(anyBegin).toBe(false);
  });
});
