'use strict';

const { getPool } = require('../db/pool');
const { AppError, ValidationError } = require('../errors/AppError');

/**
 * PUBLIC_INTERFACE
 * List alerts for a user, optionally filtered by status.
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {any} params.query
 * @returns {Promise<{ items: any[] }>}
 */
async function listAlerts({ userId, query }) {
  const status =
    query && typeof query.status === 'string' ? query.status.trim() : undefined;

  const pool = getPool();

  const where = ['user_id = $1'];
  const values = [userId];

  if (status) {
    // Keep validation lightweight; schema may be enum/text. We accept any non-empty string.
    where.push('status = $2');
    values.push(status);
  }

  const sql = `
    SELECT id, user_id, type, message, status, created_at
    FROM alerts
    WHERE ${where.join(' AND ')}
    ORDER BY created_at DESC
  `;

  try {
    const res = await pool.query(sql, values);
    return { items: res.rows || [] };
  } catch (err) {
    throw new AppError('DB_READ_FAILED', 'Unable to load alerts.', 500, {
      cause: err,
    });
  }
}

/**
 * PUBLIC_INTERFACE
 * Validate and create a new alert.
 *
 * Required:
 * - type (string)
 * - message (string)
 *
 * Optional:
 * - status (string) defaults to 'active'
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {any} params.body
 * @returns {Promise<any>} inserted alert row
 */
async function createAlert({ userId, body }) {
  const type = body && body.type;
  const message = body && body.message;
  const status = body && body.status;

  if (typeof type !== 'string' || !type.trim()) {
    throw new ValidationError(
      'Field "type" is required and must be a non-empty string.'
    );
  }
  if (typeof message !== 'string' || !message.trim()) {
    throw new ValidationError(
      'Field "message" is required and must be a non-empty string.'
    );
  }
  if (
    status !== undefined &&
    status !== null &&
    (typeof status !== 'string' || !status.trim())
  ) {
    throw new ValidationError(
      'Field "status" must be a non-empty string when provided.'
    );
  }

  const pool = getPool();

  // Ensure user row exists (best-effort, see transactions service).
  try {
    await pool.query(
      `
      INSERT INTO users (id)
      VALUES ($1)
      ON CONFLICT (id) DO NOTHING
      `,
      [userId]
    );
  } catch (err) {
    throw new AppError('DB_WRITE_FAILED', 'Unable to create alert.', 500, {
      cause: err,
    });
  }

  const sql = `
    INSERT INTO alerts (user_id, type, message, status)
    VALUES ($1, $2, $3, $4)
    RETURNING id, user_id, type, message, status, created_at
  `;
  const values = [
    userId,
    type.trim(),
    message.trim(),
    (status && status.trim()) || 'active',
  ];

  try {
    const res = await pool.query(sql, values);
    return res.rows[0];
  } catch (err) {
    throw new AppError('DB_WRITE_FAILED', 'Unable to create alert.', 500, {
      cause: err,
    });
  }
}

module.exports = {
  listAlerts,
  createAlert,
};
