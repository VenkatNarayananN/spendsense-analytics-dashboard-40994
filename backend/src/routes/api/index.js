'use strict';

const express = require('express');
const { requireSupabaseAuth, ensureUser } = require('../../middleware');

const healthApiRoutes = require('./health');
const fxApiRoutes = require('./fx');
const dbApiRoutes = require('./db');
const transactionsApiRoutes = require('./transactions');
const alertsApiRoutes = require('./alerts');
const analyticsApiRoutes = require('./analytics');
const usersApiRoutes = require('./users');
const demoApiRoutes = require('./demo');

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

// Ensure a users row exists for the authenticated subject.
// This is idempotent and will quickly no-op for returning users.
router.use(ensureUser());

 // Protected API routes
router.use('/', fxApiRoutes);
router.use('/', dbApiRoutes);
router.use('/', transactionsApiRoutes);
router.use('/', analyticsApiRoutes);
router.use('/', alertsApiRoutes);
router.use('/', usersApiRoutes);
router.use('/', demoApiRoutes);

module.exports = router;
