'use strict';

const { getPool } = require('../db/pool');
const { AppError, ValidationError } = require('../errors/AppError');

/**
 * PUBLIC_INTERFACE
 * Get the current user's profile. If the user row doesn't exist, it is created (id only).
 *
 * @param {object} params
 * @param {string} params.userId
 * @returns {Promise<any>} user row
 */
async function getMe({ userId }) {
  const pool = getPool();

  // Upsert minimal row so client always gets a stable shape.
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
    throw new AppError('DB_WRITE_FAILED', 'Unable to load user profile.', 500, { cause: err });
  }

  try {
    const res = await pool.query(
      `
      SELECT id, name, avatar_url, created_at, updated_at
      FROM users
      WHERE id = $1
      `,
      [userId]
    );
    return res.rows[0] || { id: userId, name: null, avatar_url: null };
  } catch (err) {
    throw new AppError('DB_READ_FAILED', 'Unable to load user profile.', 500, { cause: err });
  }
}

/**
 * PUBLIC_INTERFACE
 * Update the current user's profile fields (name, avatar_url).
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {any} params.body
 * @returns {Promise<any>} updated user row
 */
async function updateMe({ userId, body }) {
  const name = body && body.name;
  const avatarUrl = body && (body.avatar_url || body.avatarUrl);

  if (name !== undefined && name !== null && (typeof name !== 'string' || !name.trim())) {
    throw new ValidationError('Field "name" must be a non-empty string when provided.');
  }
  if (
    avatarUrl !== undefined &&
    avatarUrl !== null &&
    (typeof avatarUrl !== 'string' || !avatarUrl.trim())
  ) {
    throw new ValidationError('Field "avatar_url" must be a non-empty string when provided.');
  }

  if (name === undefined && avatarUrl === undefined) {
    throw new ValidationError('At least one of "name" or "avatar_url" must be provided.');
  }

  const pool = getPool();

  // Ensure row exists
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
    throw new AppError('DB_WRITE_FAILED', 'Unable to update user profile.', 500, { cause: err });
  }

  // Build dynamic update to avoid overwriting fields not provided.
  const sets = [];
  const values = [userId];
  let idx = values.length;

  if (name !== undefined) {
    idx += 1;
    sets.push(`name = $${idx}`);
    values.push(name === null ? null : name.trim());
  }
  if (avatarUrl !== undefined) {
    idx += 1;
    sets.push(`avatar_url = $${idx}`);
    values.push(avatarUrl === null ? null : avatarUrl.trim());
  }

  const sql = `
    UPDATE users
    SET ${sets.join(', ')}, updated_at = NOW()
    WHERE id = $1
    RETURNING id, name, avatar_url, created_at, updated_at
  `;

  try {
    const res = await pool.query(sql, values);
    return res.rows[0];
  } catch (err) {
    throw new AppError('DB_WRITE_FAILED', 'Unable to update user profile.', 500, { cause: err });
  }
}

module.exports = {
  getMe,
  updateMe,
};
