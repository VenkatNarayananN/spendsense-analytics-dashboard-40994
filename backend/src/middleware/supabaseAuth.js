'use strict';

const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const { AppError } = require('../errors/AppError');

/**
 * Extracts a bearer token from the Authorization header.
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function _getBearerToken(req) {
  const raw = req.get('authorization') || req.get('Authorization');
  if (!raw || typeof raw !== 'string') return null;

  const parts = raw.split(' ');
  if (parts.length !== 2) return null;

  const [scheme, token] = parts;
  if (!scheme || scheme.toLowerCase() !== 'bearer') return null;
  if (!token) return null;

  return token;
}

/**
 * Builds a JWKS URI for a Supabase project.
 * Supabase serves signing keys at:
 *   https://<PROJECT_REF>.supabase.co/auth/v1/certs
 *
 * @param {string} supabaseUrl
 * @returns {string}
 */
function _buildJwksUriFromSupabaseUrl(supabaseUrl) {
  const u = new URL(supabaseUrl);
  // Keep scheme/host, append path.
  return `${u.origin}/auth/v1/certs`;
}

/**
 * PUBLIC_INTERFACE
 * Express middleware that enforces an authenticated Supabase session for protected routes.
 *
 * How it works:
 * - Reads the Authorization header ("Bearer <jwt>")
 * - Verifies the JWT signature using Supabase JWKS
 * - Optionally validates issuer ("iss") when SUPABASE_JWT_ISSUER is set
 * - Attaches the decoded JWT payload to `req.user`
 *
 * Required env vars:
 * - SUPABASE_URL
 *
 * Optional env vars:
 * - SUPABASE_JWT_ISSUER (recommended, e.g. "https://<project-ref>.supabase.co/auth/v1")
 *
 * Error behavior:
 * - 401 if missing/invalid token
 * - 500 if server misconfigured (missing SUPABASE_URL)
 */
function requireSupabaseAuth() {
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) {
    // Fail-closed for protected endpoints; health should not use this middleware.
    console.warn('[auth] WARNING: SUPABASE_URL is not set. Protected endpoints will return 500.');
  }

  const jwksUri = supabaseUrl ? _buildJwksUriFromSupabaseUrl(supabaseUrl) : null;

  const client = jwksUri
    ? jwksClient({
        jwksUri,
        cache: true,
        cacheMaxEntries: 5,
        cacheMaxAge: 10 * 60 * 1000, // 10 minutes
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        timeout: 5000,
      })
    : null;

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  return function requireSupabaseAuthMiddleware(req, res, next) {
    if (!supabaseUrl || !client) {
      return next(
        new AppError(
          'AUTH_NOT_CONFIGURED',
          'Server authentication is not configured.',
          500
        )
      );
    }

    const token = _getBearerToken(req);
    if (!token) {
      return next(
        new AppError('UNAUTHORIZED', 'Authentication required', 401)
      );
    }

    /**
     * Key resolver for jsonwebtoken that fetches the correct public key from JWKS.
     * @param {any} header
     * @param {(err: Error | null, key?: string) => void} callback
     */
    function getKey(header, callback) {
      if (!header || !header.kid) {
        callback(new Error('Missing "kid" in JWT header.'));
        return;
      }

      client.getSigningKey(header.kid, (err, key) => {
        if (err) {
          callback(err);
          return;
        }

        // jwks-rsa exposes getPublicKey() on SigningKey
        const signingKey = key && typeof key.getPublicKey === 'function' ? key.getPublicKey() : null;
        if (!signingKey) {
          callback(new Error('Unable to resolve signing key.'));
          return;
        }

        callback(null, signingKey);
      });
    }

    const issuer = process.env.SUPABASE_JWT_ISSUER;

    jwt.verify(
      token,
      getKey,
      {
        algorithms: ['RS256'],
        ...(issuer ? { issuer } : {}),
      },
      (err, decoded) => {
        if (err) {
          // Do not leak token / internals
          return next(
            new AppError('UNAUTHORIZED', 'Authentication required', 401)
          );
        }

        // Attach user claims for downstream handlers if needed.
        req.user = decoded;
        return next();
      }
    );
  };
}

module.exports = {
  requireSupabaseAuth,
};
