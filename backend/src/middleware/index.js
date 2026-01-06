'use strict';

// This file will export middleware as the application grows
const { requireSupabaseAuth } = require('./supabaseAuth');

module.exports = {
  requireSupabaseAuth,
};
