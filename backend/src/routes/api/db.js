'use strict';

const express = require('express');
const dbController = require('../../controllers/db');

const router = express.Router();

/**
 * @swagger
 * /api/db/health:
 *   get:
 *     summary: Database health check
 *     description: >
 *       Protected endpoint that verifies database connectivity by running `SELECT 1`.
 *       Requires a valid Supabase session access token.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Database is reachable
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [ok]
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *       401:
 *         description: Missing or invalid session
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       503:
 *         description: Database unavailable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/db/health', dbController.health.bind(dbController));

module.exports = router;
