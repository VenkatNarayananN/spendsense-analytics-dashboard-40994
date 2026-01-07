'use strict';

const analyticsService = require('../services/analytics');
const { getAuthenticatedUserId } = require('../utils/auth');

class AnalyticsController {
  /**
   * PUBLIC_INTERFACE
   * Express handler: GET /api/analytics/summary
   *
   * Optional query:
   * - from,to (date range on occurred_at)
   *
   * Response:
   * { success: true, data: { summary: {...} } }
   */
  async summary(req, res, next) {
    try {
      const userId = getAuthenticatedUserId(req);
      const summary = await analyticsService.getSummary({ userId, query: req.query });

      return res.status(200).json({
        success: true,
        data: { summary },
      });
    } catch (err) {
      return next(err);
    }
  }
}

module.exports = new AnalyticsController();
