'use strict';

const { healthCheck } = require('../db/pool');

class DbController {
  /**
   * PUBLIC_INTERFACE
   * Express handler: GET /api/db/health
   * Protected endpoint (requires Supabase auth like other /api routes).
   *
   * Returns:
   * - 200 { ok: true } when SELECT 1 succeeds
   * - Standardized error JSON via centralized error handler otherwise
   */
  async health(req, res, next) {
    try {
      await healthCheck({ timeoutMs: 2000 });
      return res.status(200).json({ ok: true });
    } catch (err) {
      return next(err);
    }
  }
}

module.exports = new DbController();
