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
 *     description: Public health check endpoint (no authentication required). Not rate-limited.
 *     responses:
 *       200:
 *         description: Service health check passed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - ok
 *                 - service
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 service:
 *                   type: string
 *                   example: backend
 */
router.get('/health', healthController.check.bind(healthController));

module.exports = router;
