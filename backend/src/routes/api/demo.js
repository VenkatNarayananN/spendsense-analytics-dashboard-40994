'use strict';

const express = require('express');
const demoController = require('../../controllers/demo');

const router = express.Router();

/**
 * @swagger
 * /api/demo/seed:
 *   post:
 *     summary: Seed demo data for the authenticated user
 *     description: >
 *       Creates realistic sample transactions and alerts for the currently authenticated user.
 *       The server derives `user_id` from the Supabase JWT (no user_id accepted in the payload).
 *       This operation is idempotent per user for the same UTC day (repeat calls return 0 inserts).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               count:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 300
 *                 example: 75
 *                 description: Number of transactions to generate (alerts are always a small fixed set).
 *     responses:
 *       200:
 *         description: Demo data seeded (or already seeded today)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [success, inserted]
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 inserted:
 *                   type: object
 *                   required: [transactions, alerts]
 *                   properties:
 *                     transactions:
 *                       type: integer
 *                       example: 75
 *                     alerts:
 *                       type: integer
 *                       example: 3
 *             examples:
 *               seeded:
 *                 summary: Seeded successfully
 *                 value:
 *                   success: true
 *                   inserted:
 *                     transactions: 75
 *                     alerts: 3
 *               idempotent:
 *                 summary: Already seeded today
 *                 value:
 *                   success: true
 *                   inserted:
 *                     transactions: 0
 *                     alerts: 0
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
router.post('/demo/seed', demoController.seed.bind(demoController));

module.exports = router;
