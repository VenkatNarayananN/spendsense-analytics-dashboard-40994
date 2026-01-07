'use strict';

const express = require('express');
const alertsController = require('../../controllers/alerts');

const router = express.Router();

/**
 * @swagger
 * /api/alerts:
 *   get:
 *     summary: List alerts
 *     description: Returns alerts for the authenticated user. Optionally filter by status.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         required: false
 *         schema: { type: string, example: "active" }
 *     responses:
 *       200:
 *         description: Alerts list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [success, data]
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   required: [items]
 *                   properties:
 *                     items:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Alert'
 *       401:
 *         description: Missing or invalid session
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *   post:
 *     summary: Create alert
 *     description: Creates a new alert for the authenticated user.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AlertCreate'
 *     responses:
 *       201:
 *         description: Alert created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [success, data]
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   required: [alert]
 *                   properties:
 *                     alert:
 *                       $ref: '#/components/schemas/Alert'
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
router.get('/alerts', alertsController.list.bind(alertsController));
router.post('/alerts', alertsController.create.bind(alertsController));

module.exports = router;
