'use strict';

const express = require('express');
const healthController = require('../../controllers/health');

const router = express.Router();

/**
 * Public health endpoint at /api/health (explicitly excluded from auth and rate limiting).
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
router.get('/health', healthController.check.bind(healthController));

module.exports = router;
