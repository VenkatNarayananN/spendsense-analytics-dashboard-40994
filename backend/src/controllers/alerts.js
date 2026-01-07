'use strict';

const alertsService = require('../services/alerts');
const { getAuthenticatedUserId } = require('../utils/auth');

class AlertsController {
  /**
   * PUBLIC_INTERFACE
   * Express handler: GET /api/alerts
   *
   * Optional query:
   * - status
   *
   * Response:
   * { success: true, data: { items: Alert[] } }
   */
  async list(req, res, next) {
    try {
      const userId = getAuthenticatedUserId(req);
      const result = await alertsService.listAlerts({ userId, query: req.query });

      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      return next(err);
    }
  }

  /**
   * PUBLIC_INTERFACE
   * Express handler: POST /api/alerts
   *
   * Creates an alert.
   *
   * Response:
   * { success: true, data: { alert: Alert } }
   */
  async create(req, res, next) {
    try {
      const userId = getAuthenticatedUserId(req);
      const alert = await alertsService.createAlert({ userId, body: req.body });

      return res.status(201).json({
        success: true,
        data: { alert },
      });
    } catch (err) {
      return next(err);
    }
  }
}

module.exports = new AlertsController();
