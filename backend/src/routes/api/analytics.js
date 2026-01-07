'use strict';

const express = require('express');
const analyticsController = require('../../controllers/analytics');

const router = express.Router();

/**
 * @swagger
 * /api/analytics/summary:
 *   get:
 *     summary: Analytics summary KPIs
 *     description: >
 *       Computes summary KPIs for the authenticated user over an optional date range.
 *       KPIs include total_spend, average_daily_spend, top_categories, and recent_merchants.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         required: false
 *         schema: { type: string, example: "2025-01-01" }
 *       - in: query
 *         name: to
 *         required: false
 *         schema: { type: string, example: "2025-01-31" }
 *     responses:
 *       200:
 *         description: Summary KPIs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [success, data]
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   required: [summary]
 *                   properties:
 *                     summary:
 *                       $ref: '#/components/schemas/AnalyticsSummary'
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
router.get('/analytics/summary', analyticsController.summary.bind(analyticsController));

module.exports = router;
