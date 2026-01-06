const fxService = require('../services/fx');
const { toSafeErrorString } = require('../utils/secrets');

class FxController {
  /**
   * PUBLIC_INTERFACE
   * Express handler: GET /api/fx/latest?base=USD
   * Returns normalized FX rates from Open Exchange Rates.
   *
   * Adds caching headers:
   * - X-Cache: hit|miss|stale
   * - Cache-Control: public, max-age=60
   */
  async latest(req, res) {
    const validation = fxService.validateBase(req.query.base);
    if (!validation.ok) {
      return res.status(400).json({
        status: 'error',
        message: validation.message,
      });
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
        return res.status(500).json({
          status: 'error',
          message: 'Server is missing FX provider credentials. Please contact support.',
        });
      }

      // Upstream/provider failures => 502
      return res.status(502).json({
        status: 'error',
        message: 'Unable to fetch exchange rates right now. Please try again later.',
      });
    }
  }
}

module.exports = new FxController();
