'use strict';

const usersService = require('../services/users');
const { getAuthenticatedUserId } = require('../utils/auth');

class UsersController {
  /**
   * PUBLIC_INTERFACE
   * Express handler: GET /api/users/me
   *
   * Response:
   * { success: true, data: { user: { id, name, avatar_url, created_at?, updated_at? } } }
   */
  async me(req, res, next) {
    try {
      const userId = getAuthenticatedUserId(req);
      const user = await usersService.getMe({ userId });

      return res.status(200).json({
        success: true,
        data: { user },
      });
    } catch (err) {
      return next(err);
    }
  }

  /**
   * PUBLIC_INTERFACE
   * Express handler: PUT /api/users/me
   *
   * Allows updating:
   * - name
   * - avatar_url
   *
   * Response:
   * { success: true, data: { user: ... } }
   */
  async updateMe(req, res, next) {
    try {
      const userId = getAuthenticatedUserId(req);
      const user = await usersService.updateMe({ userId, body: req.body });

      return res.status(200).json({
        success: true,
        data: { user },
      });
    } catch (err) {
      return next(err);
    }
  }
}

module.exports = new UsersController();
