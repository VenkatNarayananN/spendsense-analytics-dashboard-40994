'use strict';

/**
 * Lightweight request logger.
 * Logs method, path, status and duration in ms.
 *
 * Security note:
 * - Intentionally does NOT log headers (e.g., Authorization) or query/body to avoid leaking secrets.
 */

// PUBLIC_INTERFACE
function requestLogger() {
  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  return function requestLoggerMiddleware(req, res, next) {
    const start = process.hrtime.bigint();

    // Log once the response is finished so we can include status code + duration.
    res.on('finish', () => {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1e6;

      // Use originalUrl (includes mount path) but excludes host; safe to log.
      const path = req.originalUrl || req.url || '';

      // Single-line log entry; avoid dumping objects.
      // Example: [req] GET /api/fx/latest 200 12.34ms
      console.log(
        `[req] ${req.method} ${path} ${res.statusCode} ${durationMs.toFixed(2)}ms`
      );
    });

    return next();
  };
}

module.exports = {
  requestLogger,
};
