'use strict';

const { AppError } = require('../errors/AppError');

/**
 * Simple in-memory rate limiter (per process).
 *
 * MVP tradeoffs:
 * - In-memory only (resets on restart; not shared across instances).
 * - Uses a fixed window counter.
 *
 * Security note:
 * - Keyed by req.ip. `app.set('trust proxy', true)` is already enabled in app.js,
 *   so req.ip should reflect the real client IP behind a proxy/load balancer.
 */

/**
 * @typedef {object} RateLimiterOptions
 * @property {number} [limit] Max requests within window.
 * @property {number} [windowMs] Window size in milliseconds.
 * @property {(req: import('express').Request) => boolean} [skip] Skip limiting for matching requests.
 */

/**
 * PUBLIC_INTERFACE
 * Create an Express middleware implementing a simple per-IP rate limit.
 *
 * @param {RateLimiterOptions} [options]
 * @returns {import('express').RequestHandler}
 */
function createRateLimiter(options = {}) {
  const limit = Number.isFinite(options.limit) ? options.limit : 100;
  const windowMs = Number.isFinite(options.windowMs)
    ? options.windowMs
    : 15 * 60 * 1000;

  const skip =
    typeof options.skip === 'function' ? options.skip : () => false;

  /** @type {Map<string, { count: number, resetAt: number }>} */
  const counters = new Map();

  // Opportunistic cleanup to avoid unbounded growth (lightweight).
  let lastCleanupAt = Date.now();
  const cleanupIntervalMs = 60 * 1000;

  /**
   * @param {number} now
   */
  function cleanup(now) {
    if (now - lastCleanupAt < cleanupIntervalMs) return;
    lastCleanupAt = now;

    for (const [ip, entry] of counters.entries()) {
      if (!entry || typeof entry.resetAt !== 'number' || entry.resetAt <= now) {
        counters.delete(ip);
      }
    }
  }

  /**
   * @param {import('express').Request} req
   * @returns {string}
   */
  function getClientKey(req) {
    // req.ip can be undefined in some edge cases; fall back to connection address.
    return (
      req.ip ||
      (req.connection && req.connection.remoteAddress) ||
      'unknown'
    );
  }

  return function rateLimiterMiddleware(req, res, next) {
    try {
      if (skip(req)) return next();

      const now = Date.now();
      cleanup(now);

      const key = getClientKey(req);
      const entry = counters.get(key);

      if (!entry || entry.resetAt <= now) {
        counters.set(key, { count: 1, resetAt: now + windowMs });
        return next();
      }

      entry.count += 1;

      if (entry.count > limit) {
        const retryAfterSeconds = Math.max(
          1,
          Math.ceil((entry.resetAt - now) / 1000)
        );

        // Helpful standard header; not required but useful and safe.
        res.set('Retry-After', String(retryAfterSeconds));

        return next(
          new AppError(
            'RATE_LIMITED',
            'Too many requests. Please try again later.',
            429,
            {
              details: {
                limit,
                windowMs,
                retryAfterSeconds,
              },
            }
          )
        );
      }

      return next();
    } catch (err) {
      // Fail open if limiter itself errors; keep service usable.
      return next(err);
    }
  };
}

module.exports = {
  createRateLimiter,
};
