'use strict';

const express = require('express');
const fxController = require('../../controllers/fx');

const router = express.Router();

/**
 * @swagger
 * /api/fx/latest:
 *   get:
 *     summary: Get latest FX rates (normalized)
 *     description: >
 *       Fetches latest exchange rates from Open Exchange Rates using the server-side
 *       environment variable OPEN_EXCHANGE_RATES_API_KEY. The response is normalized to
 *       "{ base, timestamp, rates }".
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: base
 *         required: false
 *         schema:
 *           type: string
 *           example: USD
 *         description: Base currency (allowed: USD, EUR, GBP, INR). Defaults to USD.
 *     responses:
 *       200:
 *         description: Latest FX rates
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [base, timestamp, rates]
 *               properties:
 *                 base:
 *                   type: string
 *                   example: USD
 *                 timestamp:
 *                   type: integer
 *                   example: 1700000000
 *                 rates:
 *                   type: object
 *                   additionalProperties:
 *                     type: number
 *                   example:
 *                     USD: 1
 *                     EUR: 0.92
 *                     GBP: 0.79
 *       400:
 *         description: Invalid base parameter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Missing or invalid session
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       502:
 *         description: Upstream provider error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/fx/latest', fxController.latest.bind(fxController));

module.exports = router;
