const request = require('supertest');

/**
 * These tests are intentionally lightweight:
 * - dbConfig is tested as a pure env->config resolver
 * - /api/db/health is tested with mocked auth + mocked pool healthCheck
 */

describe('dbConfig resolution', () => {
  beforeEach(() => {
    jest.resetModules();
    // Clear relevant env vars
    delete process.env.SUPABASE_DB_URL;
    delete process.env.SUPABASE_DB_HOST;
    delete process.env.SUPABASE_DB_PORT;
    delete process.env.SUPABASE_DB_NAME;
    delete process.env.SUPABASE_DB_USER;
    delete process.env.SUPABASE_DB_PASSWORD;

    delete process.env.POSTGRES_URL;
    delete process.env.POSTGRES_HOST;
    delete process.env.POSTGRES_PORT;
    delete process.env.POSTGRES_DB;
    delete process.env.POSTGRES_USER;
    delete process.env.POSTGRES_PASSWORD;

    delete process.env.PGSSLMODE;
    delete process.env.SSL;
    delete process.env.POSTGRES_SSL;
  });

  test('prefers SUPABASE_DB_URL when provided (ssl defaults on)', () => {
    process.env.SUPABASE_DB_URL = 'postgresql://user:pass@db.supabase.co:5432/postgres';

    const { resolveDbConfig } = require('../../config/dbConfig');
    const resolved = resolveDbConfig();

    expect(resolved.ok).toBe(true);
    expect(resolved.source).toBe('supabase');
    expect(resolved.pgConfig).toHaveProperty('connectionString');
    expect(resolved.pgConfig.connectionString).toBe(process.env.SUPABASE_DB_URL);

    // SSL should be enabled by default for hosted (supabase)
    expect(resolved.summary.ssl).toBe(true);
    expect(resolved.safeBanner).toContain('ssl=on');
    // Never leak full URL in banner
    expect(resolved.safeBanner).not.toContain('postgresql://');
    expect(resolved.safeBanner).not.toContain('pass');
  });

  test('uses SUPABASE discrete fields when SUPABASE_DB_URL is absent', () => {
    process.env.SUPABASE_DB_HOST = 'db.supabase.co';
    process.env.SUPABASE_DB_PORT = '5432';
    process.env.SUPABASE_DB_NAME = 'postgres';
    process.env.SUPABASE_DB_USER = 'user';
    process.env.SUPABASE_DB_PASSWORD = 'pass';

    const { resolveDbConfig } = require('../../config/dbConfig');
    const resolved = resolveDbConfig();

    expect(resolved.ok).toBe(true);
    expect(resolved.source).toBe('supabase');
    expect(resolved.pgConfig).toMatchObject({
      host: 'db.supabase.co',
      port: 5432,
      database: 'postgres',
      user: 'user',
      password: 'pass',
    });
    expect(resolved.summary.ssl).toBe(true);
  });

  test('falls back to POSTGRES_URL when supabase is not configured (ssl defaults off)', () => {
    process.env.POSTGRES_URL = 'postgresql://user:pass@localhost:5432/mydb';

    const { resolveDbConfig } = require('../../config/dbConfig');
    const resolved = resolveDbConfig();

    expect(resolved.ok).toBe(true);
    expect(resolved.source).toBe('local');
    expect(resolved.pgConfig.connectionString).toBe(process.env.POSTGRES_URL);
    expect(resolved.summary.ssl).toBe(false);
    expect(resolved.safeBanner).toContain('ssl=off');
  });
});

describe('GET /api/db/health', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('returns { ok: true } when SELECT 1 succeeds (mocked)', async () => {
    // Mock auth middleware to always allow
    jest.doMock('../../middleware', () => ({
      requireSupabaseAuth: () => (req, res, next) => next(),
      errorHandler: require('../../middleware/errorHandler').errorHandler,
      requestLogger: () => (req, res, next) => next(),
      createRateLimiter: () => (req, res, next) => next(),
    }));

    // Mock db healthCheck to succeed
    jest.doMock('../../db/pool', () => ({
      healthCheck: jest.fn().mockResolvedValue({ ok: true }),
      getPool: jest.fn(),
    }));

    const app = require('../../app');
    const res = await request(app)
      .get('/api/db/health')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  test('returns standardized error JSON when DB healthCheck fails (mocked)', async () => {
    const { AppError } = require('../../errors/AppError');

    jest.doMock('../../middleware', () => ({
      requireSupabaseAuth: () => (req, res, next) => next(),
      errorHandler: require('../../middleware/errorHandler').errorHandler,
      requestLogger: () => (req, res, next) => next(),
      createRateLimiter: () => (req, res, next) => next(),
    }));

    jest.doMock('../../db/pool', () => ({
      healthCheck: jest
        .fn()
        .mockRejectedValue(
          new AppError('DB_UNAVAILABLE', 'Database is unavailable.', 503)
        ),
      getPool: jest.fn(),
    }));

    const app = require('../../app');
    const res = await request(app)
      .get('/api/db/health')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(503);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toHaveProperty('code', 'DB_UNAVAILABLE');
    expect(res.body.error).toHaveProperty('message', 'Database is unavailable.');
  });
});
