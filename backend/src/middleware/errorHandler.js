'use strict';

const { toSafeErrorString } = require('../utils/secrets');
const { AppError } = require('../errors/AppError');

/**
 * Limit what we ever send back to the client as "cause".
 * - Never include stacks
 * - Never include raw Error objects
 * - Always redact known secrets
 * @param {unknown} cause
 * @returns {any}
 */
function _sanitizeCause(cause) {
  if (cause === undefined) return undefined;
  if (cause === null) return null;

  // If the cause is an Error, return only a safe message (no stack).
  if (cause instanceof Error) {
    return { message: toSafeErrorString(cause.message || String(cause)) };
  }

  if (typeof cause === 'string') {
    return toSafeErrorString(cause);
  }

  // For plain objects/arrays, attempt JSON stringify + redact.
  try {
    return JSON.parse(toSafeErrorString(JSON.stringify(cause)));
  } catch {
    return toSafeErrorString(String(cause));
  }
}

/**
 * Normalize any error into the standard JSON structure.
 * @param {unknown} err
 * @returns {{ status: number, body: { success: false, error: { code: string, message: string, details?: any, cause?: any } } }}
 */
function _normalizeError(err) {
  // Default for unknown/unhandled errors.
  const fallback = {
    status: 500,
    body: {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal Server Error',
      },
    },
  };

  if (!err) return fallback;

  if (err instanceof AppError) {
    const payload = {
      success: false,
      error: {
        code: err.code || 'APPLICATION_ERROR',
        message: err.message || 'An error occurred.',
      },
    };

    if (err.details !== undefined) payload.error.details = err.details;

    const sanitizedCause = _sanitizeCause(err.cause);
    if (sanitizedCause !== undefined) payload.error.cause = sanitizedCause;

    return { status: err.status || 500, body: payload };
  }

  // If some middleware/route set status/code ad-hoc, respect it but normalize shape.
  const status =
    typeof err.status === 'number' && err.status >= 400 && err.status <= 599 ? err.status : fallback.status;

  const code = typeof err.code === 'string' && err.code ? err.code : fallback.body.error.code;

  const message =
    typeof err.message === 'string' && err.message ? err.message : fallback.body.error.message;

  const payload = {
    success: false,
    error: {
      code,
      message,
    },
  };

  // Never attach unknown object internals as details by default; keep responses safe/minimal.
  return { status, body: payload };
}

/**
 * PUBLIC_INTERFACE
 * Express error-handling middleware (must be registered after all routes).
 * Produces a consistent error response:
 * `{ success: false, error: { code, message, details?, cause? } }`
 *
 * It also logs a redacted/safe representation of the error.
 *
 * @param {any} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function errorHandler(err, req, res, next) {
  // If headers already sent, delegate to default Express handler.
  if (res.headersSent) return next(err);

  // Log safely (redact known secrets).
  console.error(`[error] ${req.method} ${req.originalUrl}: ${toSafeErrorString(err)}`);

  const normalized = _normalizeError(err);
  return res.status(normalized.status).json(normalized.body);
}

module.exports = {
  errorHandler,
};
