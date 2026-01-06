'use strict';

/**
 * @typedef {object} StandardErrorPayload
 * @property {false} success
 * @property {{ code: string, message: string, details?: any, cause?: any }} error
 */

/**
 * Base application error with consistent metadata for the centralized error handler.
 */
class AppError extends Error {
  /**
   * PUBLIC_INTERFACE
   * Create a new AppError.
   * @param {string} code Stable, machine-readable error code.
   * @param {string} message Human-readable safe message.
   * @param {number} status HTTP status code to return.
   * @param {object} [options]
   * @param {any} [options.details] Safe, non-secret details for clients.
   * @param {unknown} [options.cause] Optional cause; should be sanitized before returning to clients.
   */
  constructor(code, message, status, options = {}) {
    super(message);
    this.name = this.constructor.name;

    this.code = code;
    this.status = status;

    if (options && Object.prototype.hasOwnProperty.call(options, 'details')) {
      this.details = options.details;
    }
    if (options && Object.prototype.hasOwnProperty.call(options, 'cause')) {
      this.cause = options.cause;
    }
  }
}

/**
 * Error representing failures from an upstream/external API.
 * Intentionally carries *sanitized* upstream context and maps to a gateway error.
 */
class ExternalApiError extends AppError {
  /**
   * PUBLIC_INTERFACE
   * Create an ExternalApiError.
   * @param {object} params
   * @param {string} params.service Upstream service name (e.g., "openexchangerates").
   * @param {string} params.message Safe message for clients.
   * @param {number} [params.upstreamStatus] Upstream HTTP status code.
   * @param {any} [params.upstreamBody] Upstream body (must already be sanitized).
   * @param {string} [params.code] Optional override error code.
   */
  constructor({ service, message, upstreamStatus, upstreamBody, code }) {
    super(code || 'EXTERNAL_API_ERROR', message, 502, {
      details: {
        service,
        upstreamStatus,
        upstreamBody,
      },
    });

    this.service = service;
    this.upstreamStatus = upstreamStatus;
    this.upstreamBody = upstreamBody;
  }
}

/**
 * Error representing a missing route.
 */
class NotFoundError extends AppError {
  /**
   * PUBLIC_INTERFACE
   * @param {string} message
   * @param {object} [details]
   */
  constructor(message = 'Route not found.', details) {
    super('NOT_FOUND', message, 404, { details });
  }
}

/**
 * Error representing invalid input.
 */
class ValidationError extends AppError {
  /**
   * PUBLIC_INTERFACE
   * @param {string} message
   * @param {object} [details]
   */
  constructor(message, details) {
    super('VALIDATION_ERROR', message, 400, { details });
  }
}

module.exports = {
  AppError,
  ExternalApiError,
  NotFoundError,
  ValidationError,
};
