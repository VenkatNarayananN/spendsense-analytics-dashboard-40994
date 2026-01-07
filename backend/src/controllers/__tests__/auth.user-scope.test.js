const request = require('supertest');

/**
 * Minimal tests for auth-aware data access:
 * - list endpoints include user_id scoping in SQL/params
 * - create endpoints ignore any client-provided user_id and use authenticated user id
 */
describe('Auth-aware user scoping (transactions, alerts)', () => {
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

  test('GET /api/transactions scopes by authenticated user_id', async () => {
    const query = jest
      .fn()
      // count query
      .mockResolvedValueOnce({ rows: [{ total: 0 }] })
      // list query
      .mockResolvedValueOnce({ rows: [] });

    jest.doMock('../../db/pool', () => ({
      getPool: () => ({ query }),
      healthCheck: jest.fn(),
    }));

    const app = require('../../app');
    const res = await request(app)
      .get('/api/transactions?limit=10&offset=0')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);

    // Ensure both queries include user_id predicate with $1 = user-123.
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('FROM transactions'),
      expect.arrayContaining(['user-123'])
    );

    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('FROM transactions'),
      expect.arrayContaining(['user-123'])
    );

    // Stronger: the WHERE should include user_id = $1
    const [countSql] = query.mock.calls[0];
    const [listSql] = query.mock.calls[1];
    expect(countSql).toContain('user_id = $1');
    expect(listSql).toContain('user_id = $1');
  });

  test('POST /api/transactions ignores body.user_id and uses authenticated userId', async () => {
    const query = jest
      .fn()
      // upsert users
      .mockResolvedValueOnce({ rows: [] })
      // insert transaction return
      .mockResolvedValueOnce({
        rows: [
          {
            id: 't1',
            user_id: 'user-123',
            amount: 12,
            currency: 'USD',
            category: 'Food',
            merchant: 'Shop',
            description: null,
            occurred_at: '2025-01-01T00:00:00Z',
            created_at: '2025-01-01T00:00:01Z',
          },
        ],
      });

    jest.doMock('../../db/pool', () => ({
      getPool: () => ({ query }),
      healthCheck: jest.fn(),
    }));

    const app = require('../../app');
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', 'Bearer test-token')
      .send({
        user_id: 'attacker-999',
        amount: 12,
        currency: 'USD',
        category: 'Food',
        merchant: 'Shop',
        occurred_at: '2025-01-01T00:00:00Z',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.transaction.user_id).toBe('user-123');

    // Insert should pass userId as first parameter (not attacker-999).
    const insertCall = query.mock.calls[1];
    expect(insertCall[0]).toContain('INSERT INTO transactions');
    expect(insertCall[1][0]).toBe('user-123');
    expect(insertCall[1]).not.toContain('attacker-999');
  });

  test('GET /api/alerts scopes by authenticated user_id', async () => {
    const query = jest.fn().mockResolvedValueOnce({ rows: [] });

    jest.doMock('../../db/pool', () => ({
      getPool: () => ({ query }),
      healthCheck: jest.fn(),
    }));

    const app = require('../../app');
    const res = await request(app)
      .get('/api/alerts')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('FROM alerts'),
      expect.arrayContaining(['user-123'])
    );

    const [sql] = query.mock.calls[0];
    expect(sql).toContain('user_id = $1');
  });

  test('POST /api/alerts ignores body.user_id and uses authenticated userId', async () => {
    const query = jest
      .fn()
      // upsert users
      .mockResolvedValueOnce({ rows: [] })
      // insert alert return
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'a1',
            user_id: 'user-123',
            type: 'budget',
            message: 'hello',
            status: 'active',
            created_at: '2025-01-01T00:00:01Z',
          },
        ],
      });

    jest.doMock('../../db/pool', () => ({
      getPool: () => ({ query }),
      healthCheck: jest.fn(),
    }));

    const app = require('../../app');
    const res = await request(app)
      .post('/api/alerts')
      .set('Authorization', 'Bearer test-token')
      .send({
        user_id: 'attacker-999',
        type: 'budget',
        message: 'hello',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.alert.user_id).toBe('user-123');

    const insertCall = query.mock.calls[1];
    expect(insertCall[0]).toContain('INSERT INTO alerts');
    expect(insertCall[1][0]).toBe('user-123');
    expect(insertCall[1]).not.toContain('attacker-999');
  });
});
