'use strict';

// This file will export middleware as the application grows
const { requireSupabaseAuth } = require('./supabaseAuth');
const { errorHandler } = require('./errorHandler');

module.exports = {
  requireSupabaseAuth,
  errorHandler,
};
