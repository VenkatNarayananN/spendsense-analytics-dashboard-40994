'use strict';

const express = require('express');
const { requireSupabaseAuth } = require('../../middleware');

const healthApiRoutes = require('./health');
const fxApiRoutes = require('./fx');
const dbApiRoutes = require('./db');

const router = express.Router();

/**
 * Public health endpoint (no auth).
 * Mounted first so it is excluded from /api auth enforcement below.
 */
router.use('/', healthApiRoutes);

// Enforce authentication for all remaining /api routes.
router.use((req, res, next) => {
  // Since health routes are mounted above, this is just a safe guard.
  if (req.path === '/health') return next();
  return requireSupabaseAuth()(req, res, next);
});

// Protected API routes
router.use('/', fxApiRoutes);
router.use('/', dbApiRoutes);

module.exports = router;
