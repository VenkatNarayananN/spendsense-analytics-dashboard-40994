const request = require('supertest');

describe('Ensure user record on authenticated requests', () => {
  beforeEach(() => {
    jest.resetModules();

    // Mock auth middleware so req.user exists and includes trusted profile claims.
    jest.doMock('../../middleware', () => {
      const actualErrorHandler = require('../../middleware/errorHandler').errorHandler;

      return {
        requireSupabaseAuth: () => (req, res, next) => {
          req.user = {
            sub: 'user-123',
            email: 'user@example.com',
            user_metadata: {
              full_name: 'Test User',
              avatar_url: 'https://example.com/avatar.png',
            },
          };
          return next();
        },
        // Keep ensureUser real so we test its behavior.
        ensureUser: require('../../middleware/ensureUser').ensureUser,
        errorHandler: actualErrorHandler,
        requestLogger: () => (req, res, next) => next(),
        createRateLimiter: () => (req, res, next) => next(),
      };
    });
  });

  test('First authenticated request creates/ensures user (upsert with email/name/avatar)', async () => {
    const query = jest
      .fn()
      // ensureUserFromAuthClaims() upsert
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'user-123',
            email: 'user@example.com',
            name: 'Test User',
            avatar_url: 'https://example.com/avatar.png',
          },
        ],
      })
      // /api/users/me getMe(): insert id-only (ignored) then select
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ id: 'user-123', name: 'Test User', avatar_url: 'https://example.com/avatar.png' }],
      });

    jest.doMock('../../db/pool', () => ({
      getPool: () => ({ query }),
      healthCheck: jest.fn(),
    }));

    const app = require('../../app');

    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // ensureUser upsert ran first
    expect(query.mock.calls[0][0]).toContain('INSERT INTO users (id, email, name, avatar_url)');
    expect(query.mock.calls[0][1]).toEqual([
      'user-123',
      'user@example.com',
      'Test User',
      'https://example.com/avatar.png',
    ]);
  });

  test('Subsequent authenticated requests do not create duplicates (middleware throttle avoids repeated upsert)', async () => {
    const query = jest
      .fn()
      // First request: ensureUserFromAuthClaims upsert
      .mockResolvedValueOnce({ rows: [{ id: 'user-123' }] })
      // First request: getMe insert/select
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'user-123', name: null, avatar_url: null }] })
      // Second request: getMe insert/select (no ensure upsert this time)
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'user-123', name: null, avatar_url: null }] });

    jest.doMock('../../db/pool', () => ({
      getPool: () => ({ query }),
      healthCheck: jest.fn(),
    }));

    const app = require('../../app');

    const r1 = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer test-token');
    expect(r1.status).toBe(200);

    const r2 = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer test-token');
    expect(r2.status).toBe(200);

    // Total calls:
    // - first request: 1 (ensure upsert) + 2 (getMe insert+select) = 3
    // - second request: 2 (getMe insert+select) = 2
    // -> 5 total
    expect(query).toHaveBeenCalledTimes(5);

    // Only one upsert statement should appear (call #1).
    const sqls = query.mock.calls.map((c) => c[0]);
    const upsertCount = sqls.filter((s) =>
      String(s).includes('INSERT INTO users (id, email, name, avatar_url)')
    ).length;
    expect(upsertCount).toBe(1);
  });

  test('POST /api/users/ensure is idempotent and uses JWT claims (no body trusted)', async () => {
    const query = jest.fn().mockResolvedValueOnce({
      rows: [
        {
          id: 'user-123',
          email: 'user@example.com',
          name: 'Test User',
          avatar_url: 'https://example.com/avatar.png',
        },
      ],
    });

    jest.doMock('../../db/pool', () => ({
      getPool: () => ({ query }),
      healthCheck: jest.fn(),
    }));

    const app = require('../../app');

    const res = await request(app)
      .post('/api/users/ensure')
      .set('Authorization', 'Bearer test-token')
      // Attempted spoofing should not matter (controller does not read body)
      .send({ email: 'attacker@example.com', name: 'Attacker', avatar_url: 'https://evil.test/a.png' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO users (id, email, name, avatar_url)'),
      ['user-123', 'user@example.com', 'Test User', 'https://example.com/avatar.png']
    );
  });

  test('Unauthenticated requests do not create users (401)', async () => {
    jest.resetModules();

    // Use real app (auth middleware will fail closed in test env when SUPABASE_URL is missing)
    const app = require('../../app');

    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
  });
});
