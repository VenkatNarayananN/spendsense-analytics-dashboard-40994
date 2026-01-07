'use strict';

const { getAuthenticatedUserId } = require('../utils/auth');
const demoSeedService = require('../services/demoSeed');

class DemoController {
  /**
   * PUBLIC_INTERFACE
   * Express handler: POST /api/demo/seed
   *
   * Protected endpoint that seeds realistic demo data (transactions + alerts)
   * for the currently authenticated user.
   *
   * Notes:
   * - The user_id is always derived server-side from the auth context.
   * - Optional body: { count?: number } controls number of transactions (default ~75).
   * - Idempotent per user per UTC day: second call same day returns inserted counts 0.
   *
   * Response:
   * { success: true, inserted: { transactions: N, alerts: M } }
   */
  async seed(req, res, next) {
    try {
      const userId = getAuthenticatedUserId(req);

      const result = await demoSeedService.seedDemoDataForUser({
        userId,
        body: req.body,
      });

      return res.status(200).json({
        success: true,
        inserted: result.inserted,
      });
    } catch (err) {
      return next(err);
    }
  }
}

module.exports = new DemoController();
