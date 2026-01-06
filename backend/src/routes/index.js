const express = require('express');
const healthController = require('../controllers/health');
const fxController = require('../controllers/fx');
const { requireSupabaseAuth } = require('../middleware');

const router = express.Router();

/**
 * Public health endpoint kept for backward compatibility.
 *
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
 * Public health endpoint at /api/health (explicitly excluded from auth).
 *
 * @swagger
 * /api/health:
 *   get:
 *     summary: API health endpoint
 *     description: Public health check endpoint (no authentication required).
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
router.get('/api/health', healthController.check.bind(healthController));

// Enforce authentication for all remaining /api routes (health excluded above).
router.use('/api', (req, res, next) => {
  if (req.path === '/health') return next();
  return requireSupabaseAuth()(req, res, next);
});

/**
 * @swagger
 * /api/fx/latest:
 *   get:
 *     summary: Get latest FX rates (normalized)
 *     description: >
 *       Fetches latest exchange rates from Open Exchange Rates using the server-side
 *       environment variable OPEN_EXCHANGE_RATES_API_KEY. The response is normalized to
 *       `{ base, timestamp, rates }`.
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
router.get('/api/fx/latest', fxController.latest.bind(fxController));

module.exports = router;
