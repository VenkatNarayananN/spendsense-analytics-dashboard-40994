'use strict';

// This file will export middleware as the application grows
const { requireSupabaseAuth } = require('./supabaseAuth');
const { ensureUser } = require('./ensureUser');
const { errorHandler } = require('./errorHandler');
const { requestLogger } = require('./requestLogger');
const { createRateLimiter } = require('./rateLimiter');

module.exports = {
  requireSupabaseAuth,
  ensureUser,
  errorHandler,
  requestLogger,
  createRateLimiter,
};
