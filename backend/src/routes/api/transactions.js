'use strict';

const express = require('express');
const transactionsController = require('../../controllers/transactions');

const router = express.Router();

/**
 * @swagger
 * /api/transactions:
 *   get:
 *     summary: List transactions
 *     description: >
 *       Returns a paginated list of transactions for the authenticated user.
 *       Supports optional filtering by occurred_at date range (from,to), category, and merchant.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         required: false
 *         schema: { type: string, example: "2025-01-01" }
 *         description: Start date/time (inclusive) applied to occurred_at.
 *       - in: query
 *         name: to
 *         required: false
 *         schema: { type: string, example: "2025-01-31" }
 *         description: End date/time (inclusive) applied to occurred_at.
 *       - in: query
 *         name: category
 *         required: false
 *         schema: { type: string, example: "Groceries" }
 *       - in: query
 *         name: merchant
 *         required: false
 *         schema: { type: string, example: "Target" }
 *         description: Case-insensitive partial match.
 *       - in: query
 *         name: limit
 *         required: false
 *         schema: { type: integer, example: 50, minimum: 1, maximum: 200 }
 *       - in: query
 *         name: offset
 *         required: false
 *         schema: { type: integer, example: 0, minimum: 0 }
 *     responses:
 *       200:
 *         description: Paginated transactions list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [success, data]
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   required: [items, page]
 *                   properties:
 *                     items:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Transaction'
 *                     page:
 *                       type: object
 *                       required: [limit, offset, total]
 *                       properties:
 *                         limit: { type: integer, example: 50 }
 *                         offset: { type: integer, example: 0 }
 *                         total: { type: integer, example: 123 }
 *       401:
 *         description: Missing or invalid session
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *   post:
 *     summary: Create transaction
 *     description: Creates a new transaction for the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TransactionCreate'
 *     responses:
 *       201:
 *         description: Transaction created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [success, data]
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   required: [transaction]
 *                   properties:
 *                     transaction:
 *                       $ref: '#/components/schemas/Transaction'
 *       401:
 *         description: Missing or invalid session
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.get('/transactions', transactionsController.list.bind(transactionsController));
router.post('/transactions', transactionsController.create.bind(transactionsController));

module.exports = router;
