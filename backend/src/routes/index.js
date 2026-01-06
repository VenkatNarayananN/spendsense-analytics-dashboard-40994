const express = require('express');
const healthController = require('../controllers/health');
const fxController = require('../controllers/fx');

const router = express.Router();
// Health endpoint

/**
 * @swagger
 * /:
 *   get:
 *     summary: Health endpoint
 *     responses:
 *       200:
 *         description: Service health check passed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 message:
 *                   type: string
 *                   example: Service is healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 environment:
 *                   type: string
 *                   example: development
 */
router.get('/', healthController.check.bind(healthController));

/**
 * @swagger
 * /api/fx/latest:
 *   get:
 *     summary: Get latest FX rates (normalized)
 *     description: >
 *       Fetches latest exchange rates from Open Exchange Rates using the server-side
 *       environment variable OPEN_EXCHANGE_RATES_API_KEY. The response is normalized to
 *       `{ base, timestamp, rates }`.
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
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: error
 *                 message:
 *                   type: string
 *                   example: Query param "base" must be a 3-letter ISO currency code (e.g., USD).
 *       502:
 *         description: Upstream provider error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: error
 *                 message:
 *                   type: string
 *                   example: Unable to fetch exchange rates right now. Please try again later.
 */
router.get('/api/fx/latest', fxController.latest.bind(fxController));

module.exports = router;
