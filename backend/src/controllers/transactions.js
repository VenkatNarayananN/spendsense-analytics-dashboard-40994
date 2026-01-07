'use strict';

const transactionsService = require('../services/transactions');
const { getAuthenticatedUserId } = require('../utils/auth');

class TransactionsController {
  /**
   * PUBLIC_INTERFACE
   * Express handler: GET /api/transactions
   *
   * Supports filtering:
   * - from,to (date range on occurred_at)
   * - category (exact)
   * - merchant (ILIKE partial)
   * - limit,offset pagination
   *
   * Response:
   * { success: true, data: { items: Transaction[], page: { limit, offset, total } } }
   */
  async list(req, res, next) {
    try {
      const userId = getAuthenticatedUserId(req);
      const result = await transactionsService.listTransactions({ userId, query: req.query });

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
   * Express handler: POST /api/transactions
   *
   * Creates a transaction for the authenticated user.
   *
   * Response:
   * { success: true, data: { transaction: Transaction } }
   */
  async create(req, res, next) {
    try {
      const userId = getAuthenticatedUserId(req);
      const transaction = await transactionsService.createTransaction({
        userId,
        body: req.body,
      });

      return res.status(201).json({
        success: true,
        data: { transaction },
      });
    } catch (err) {
      return next(err);
    }
  }
}

module.exports = new TransactionsController();
