'use strict';

const usersService = require('../services/users');
const { getAuthenticatedUserId } = require('../utils/auth');

/**
 * Attempt to extract trusted profile fields from a Supabase JWT.
 * We do NOT accept client-provided values for initial create.
 *
 * @param {any} claims decoded JWT payload (req.user)
 * @returns {{ email: string|null, name: string|null, avatar_url: string|null }}
 */
function _extractProfileFromJwtClaims(claims) {
  const rawEmail =
    (claims && (claims.email || (claims.user_metadata && claims.user_metadata.email))) || null;

  // Supabase commonly puts these under user_metadata (for OAuth providers like Google).
  const userMetadata = (claims && claims.user_metadata) || {};
  const rawName =
    claims?.name ||
    claims?.full_name ||
    userMetadata?.full_name ||
    userMetadata?.name ||
    userMetadata?.preferred_username ||
    null;

  const rawAvatar =
    claims?.picture ||
    claims?.avatar_url ||
    userMetadata?.avatar_url ||
    userMetadata?.picture ||
    null;

  const email = typeof rawEmail === 'string' && rawEmail.trim() ? rawEmail.trim() : null;
  const name = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : null;
  const avatar_url =
    typeof rawAvatar === 'string' && rawAvatar.trim() ? rawAvatar.trim() : null;

  return { email, name, avatar_url };
}

/**
 * PUBLIC_INTERFACE
 * Express middleware that ensures a `users` row exists for the authenticated Supabase user.
 *
 * Behavior:
 * - Uses Supabase JWT claims (trusted) to upsert `users` with:
 *   { id (sub), email, name, avatar_url }
 * - Safe/idempotent: does not create duplicates; does not overwrite existing non-null fields
 * - Throttled per-process to reduce DB reads/writes (defaults to once per user per 10 minutes)
 *
 * Notes:
 * - This middleware assumes `requireSupabaseAuth()` already ran and populated `req.user`.
 * - If it fails, we fail the request with a 500 because downstream endpoints generally
 *   depend on having a user row (FKs, scoping, etc.).
 */
function ensureUser() {
  // Simple in-memory throttle by user id. OK because it's only an optimization.
  // In multi-instance deployments, each instance will do its own occasional ensure.
  const lastEnsuredAt = new Map(); // userId -> ms epoch
  const ttlMs = 10 * 60 * 1000;

  return async function ensureUserMiddleware(req, res, next) {
    try {
      const userId = getAuthenticatedUserId(req);

      const now = Date.now();
      const prev = lastEnsuredAt.get(userId);
      if (prev && now - prev < ttlMs) return next();

      // Mark before doing the DB call to reduce stampedes within the same process.
      lastEnsuredAt.set(userId, now);

      const { email, name, avatar_url } = _extractProfileFromJwtClaims(req.user);

      // If email is missing, do not attempt to upsert. The DB schema requires email NOT NULL
      // (see migrations). In a properly configured Supabase session, email should exist.
      if (!email) return next();

      await usersService.ensureUserFromAuthClaims({
        userId,
        email,
        name,
        avatarUrl: avatar_url,
      });

      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = {
  ensureUser,
};
