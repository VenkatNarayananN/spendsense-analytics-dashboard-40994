const request = require('supertest');
const express = require('express');
const { createRateLimiter } = require('../../middleware');
const { errorHandler } = require('../../middleware');

describe('Rate limiting middleware', () => {
  test('returns 429 in standardized error shape when limit exceeded', async () => {
    const app = express();

    // Apply rate limiter with a tiny limit for a fast deterministic test.
    app.set('trust proxy', true);
    app.use(
      createRateLimiter({
        limit: 2,
        windowMs: 60 * 1000,
        skip: (req) => req.path === '/api/health',
      })
    );

    // Simple routes (no auth involvement in this unit test)
    app.get('/api/test', (req, res) => res.status(200).json({ ok: true }));
    app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));

    // Ensure standardized error response via centralized error handler.
    app.use(errorHandler);

    const first = await request(app).get('/api/test');
    expect(first.status).toBe(200);

    const second = await request(app).get('/api/test');
    expect(second.status).toBe(200);

    const third = await request(app).get('/api/test');
    expect(third.status).toBe(429);
    expect(third.body).toHaveProperty('success', false);
    expect(third.body).toHaveProperty('error');
    expect(third.body.error).toHaveProperty('code', 'RATE_LIMITED');
    expect(third.body.error).toHaveProperty('message');
    expect(third.body.error).toHaveProperty('details');
    expect(third.body.error.details).toHaveProperty('retryAfterSeconds');
  });

  test('does not rate-limit /api/health', async () => {
    const app = express();
    app.set('trust proxy', true);

    app.use(
      createRateLimiter({
        limit: 1,
        windowMs: 60 * 1000,
        skip: (req) => req.path === '/api/health',
      })
    );

    app.get('/api/health', (req, res) => res.status(200).json({ status: 'ok' }));
    app.use(errorHandler);

    const first = await request(app).get('/api/health');
    expect(first.status).toBe(200);

    const second = await request(app).get('/api/health');
    expect(second.status).toBe(200);
  });
});
