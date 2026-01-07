'use strict';

const { AppError } = require('../errors/AppError');

/**
 * PUBLIC_INTERFACE
 * Extract the authenticated Supabase user id from the request.
 *
 * Supabase access tokens typically include the subject in `sub`.
 *
 * @param {import('express').Request} req
 * @returns {string} userId
 * @throws {AppError} if user is not present on request (should not happen if auth middleware ran)
 */
function getAuthenticatedUserId(req) {
  const userId = req && req.user && (req.user.sub || req.user.user_id || req.user.uid);
  if (!userId || typeof userId !== 'string') {
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }
  return userId;
}

module.exports = {
  getAuthenticatedUserId,
};
