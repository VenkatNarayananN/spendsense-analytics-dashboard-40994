const fxService = require('../services/fx');
const { toSafeErrorString } = require('../utils/secrets');
const { ValidationError, AppError } = require('../errors/AppError');

class FxController {
  /**
   * PUBLIC_INTERFACE
   * Express handler: GET /api/fx/latest?base=USD
   * Returns normalized FX rates from Open Exchange Rates.
   *
   * Adds caching headers:
   * - X-Cache: hit|miss|stale
   * - Cache-Control: public, max-age=60
   *
   * Error shape:
   * `{ success: false, error: { code, message, details?, cause? } }`
   */
  async latest(req, res, next) {
    const validation = fxService.validateBase(req.query.base);
    if (!validation.ok) {
      return next(new ValidationError(validation.message));
    }

    try {
      const result = await fxService.fetchLatestRatesCached(validation.base);

      // Cache headers are always set for successful responses (including stale).
      res.set('X-Cache', result.cache);
      res.set('Cache-Control', 'public, max-age=60');

      return res.status(200).json(result.payload);
    } catch (err) {
      // Log safely (never leak provider keys).
      console.error(`[fx] /api/fx/latest failed: ${toSafeErrorString(err)}`);

      // Missing key is a server config issue; we still return a friendly message.
      if (err && err.code === 'MISSING_API_KEY') {
        return next(
          new AppError(
            'MISSING_API_KEY',
            'Server is missing FX provider credentials. Please contact support.',
            500
          )
        );
      }

      // ExternalApiError and other AppError instances will be normalized by middleware.
      return next(err);
    }
  }
}

module.exports = new FxController();
