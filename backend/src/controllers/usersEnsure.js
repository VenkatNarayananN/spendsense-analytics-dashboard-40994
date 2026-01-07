'use strict';

const usersService = require('../services/users');
const { getAuthenticatedUserId } = require('../utils/auth');

class UsersEnsureController {
  /**
   * PUBLIC_INTERFACE
   * Express handler: POST /api/users/ensure
   *
   * Idempotent endpoint that ensures the authenticated user exists in DB.
   * It uses ONLY trusted Supabase JWT claims for initial profile fields.
   *
   * Response:
   * { success: true, data: { user: { id, email, name, avatar_url, created_at?, updated_at? } } }
   */
  async ensure(req, res, next) {
    try {
      const userId = getAuthenticatedUserId(req);

      const claims = req.user || {};
      const email =
        typeof claims.email === 'string'
          ? claims.email
          : typeof claims?.user_metadata?.email === 'string'
            ? claims.user_metadata.email
            : null;

      const name =
        claims?.name ||
        claims?.full_name ||
        claims?.user_metadata?.full_name ||
        claims?.user_metadata?.name ||
        claims?.user_metadata?.preferred_username ||
        null;

      const avatarUrl =
        claims?.picture ||
        claims?.avatar_url ||
        claims?.user_metadata?.avatar_url ||
        claims?.user_metadata?.picture ||
        null;

      if (!email || typeof email !== 'string' || !email.trim()) {
        // If the token doesn't contain email, we cannot satisfy DB constraints safely.
        return res.status(200).json({
          success: true,
          data: { user: { id: userId, email: null, name: null, avatar_url: null } },
        });
      }

      const user = await usersService.ensureUserFromAuthClaims({
        userId,
        email,
        name,
        avatarUrl,
      });

      return res.status(200).json({
        success: true,
        data: { user },
      });
    } catch (err) {
      return next(err);
    }
  }
}

module.exports = new UsersEnsureController();
