const fxService = require('../services/fx');

class FxController {
  /**
   * PUBLIC_INTERFACE
   * Express handler: GET /api/fx/latest?base=USD
   * Returns normalized FX rates from Open Exchange Rates.
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
      const payload = await fxService.fetchLatestRates(validation.base);
      return res.status(200).json(payload);
    } catch (err) {
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

