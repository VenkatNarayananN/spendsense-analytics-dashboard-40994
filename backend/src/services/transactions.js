'use strict';

const { getPool } = require('../db/pool');
const { AppError, ValidationError } = require('../errors/AppError');

/**
 * @param {unknown} v
 * @param {number} fallback
 * @returns {number}
 */
function _intOrFallback(v, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.floor(n);
}

/**
 * @param {unknown} v
 * @returns {string|undefined}
 */
function _stringOrUndefined(v) {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  return s ? s : undefined;
}

/**
 * Parse a YYYY-MM-DD or ISO date-time string into a Date (or return null).
 * @param {string} s
 * @returns {Date|null}
 */
function _parseDate(s) {
  const d = new Date(s);
  // Invalid Date => NaN time
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/**
 * PUBLIC_INTERFACE
 * List paginated transactions for a user with basic filtering.
 *
 * Query filters:
 * - from,to: date or datetime strings (applied against occurred_at)
 * - category: exact match
 * - merchant: case-insensitive partial match
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {any} params.query
 * @returns {Promise<{ items: any[], page: { limit: number, offset: number, total: number } }>}
 */
async function listTransactions({ userId, query }) {
  const limit = Math.min(Math.max(_intOrFallback(query.limit, 50), 1), 200);
  const offset = Math.max(_intOrFallback(query.offset, 0), 0);

  const category = _stringOrUndefined(query.category);
  const merchant = _stringOrUndefined(query.merchant);
  const from = _stringOrUndefined(query.from);
  const to = _stringOrUndefined(query.to);

  const where = ['user_id = $1'];
  /** @type {any[]} */
  const values = [userId];
  let idx = values.length;

  if (from) {
    const d = _parseDate(from);
    if (!d) throw new ValidationError('Query param "from" must be a valid date/time string.');
    idx += 1;
    where.push(`occurred_at >= $${idx}`);
    values.push(d.toISOString());
  }

  if (to) {
    const d = _parseDate(to);
    if (!d) throw new ValidationError('Query param "to" must be a valid date/time string.');
    idx += 1;
    where.push(`occurred_at <= $${idx}`);
    values.push(d.toISOString());
  }

  if (category) {
    idx += 1;
    where.push(`category = $${idx}`);
    values.push(category);
  }

  if (merchant) {
    idx += 1;
    where.push(`merchant ILIKE $${idx}`);
    values.push(`%${merchant}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const pool = getPool();

  const countSql = `SELECT COUNT(*)::int AS total FROM transactions ${whereSql}`;
  const countRes = await pool.query(countSql, values);
  const total = (countRes.rows && countRes.rows[0] && countRes.rows[0].total) || 0;

  // Pagination params at end so they don't affect count query.
  const listValues = values.slice();
  listValues.push(limit);
  listValues.push(offset);

  const listSql = `
    SELECT
      id,
      user_id,
      amount,
      currency,
      category,
      merchant,
      description,
      occurred_at,
      created_at
    FROM transactions
    ${whereSql}
    ORDER BY occurred_at DESC, created_at DESC
    LIMIT $${listValues.length - 1}
    OFFSET $${listValues.length}
  `;

  const res = await pool.query(listSql, listValues);

  return {
    items: res.rows || [],
    page: { limit, offset, total },
  };
}

/**
 * PUBLIC_INTERFACE
 * Validate and create a transaction for the authenticated user.
 *
 * Required:
 * - amount (number)
 * - currency (3-letter ISO, e.g. USD)
 * - category (string)
 * - merchant (string)
 * - occurred_at (date/time)
 *
 * Optional:
 * - description (string)
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {any} params.body
 * @returns {Promise<any>} inserted transaction row
 */
async function createTransaction({ userId, body }) {
  const amount = body && body.amount;
  const currency = body && body.currency;
  const category = body && body.category;
  const merchant = body && body.merchant;
  const description = body && body.description;
  const occurredAt = body && (body.occurred_at || body.occurredAt);

  if (!Number.isFinite(Number(amount))) {
    throw new ValidationError('Field "amount" is required and must be a number.');
  }

  if (typeof currency !== 'string' || !/^[A-Za-z]{3}$/.test(currency.trim())) {
    throw new ValidationError('Field "currency" is required and must be a 3-letter ISO code.');
  }

  if (typeof category !== 'string' || !category.trim()) {
    throw new ValidationError('Field "category" is required and must be a non-empty string.');
  }

  if (typeof merchant !== 'string' || !merchant.trim()) {
    throw new ValidationError('Field "merchant" is required and must be a non-empty string.');
  }

  if (occurredAt === undefined || occurredAt === null || occurredAt === '') {
    throw new ValidationError('Field "occurred_at" is required.');
  }

  const occurredDate = _parseDate(String(occurredAt));
  if (!occurredDate) {
    throw new ValidationError('Field "occurred_at" must be a valid date/time string.');
  }

  if (description !== undefined && description !== null && typeof description !== 'string') {
    throw new ValidationError('Field "description" must be a string when provided.');
  }

  const pool = getPool();

  // Ensure user row exists in users table (id = supabase user id).
  // If the table schema differs, this may fail; we intentionally bubble the error through the centralized handler.
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
    // Non-fatal for inserting transaction if FK isn't present; but if FK exists and user doesn't, we want this to help.
    throw new AppError('DB_WRITE_FAILED', 'Unable to create transaction.', 500, { cause: err });
  }

  const insertSql = `
    INSERT INTO transactions
      (user_id, amount, currency, category, merchant, description, occurred_at)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7)
    RETURNING
      id, user_id, amount, currency, category, merchant, description, occurred_at, created_at
  `;

  const values = [
    userId,
    Number(amount),
    currency.trim().toUpperCase(),
    category.trim(),
    merchant.trim(),
    description === undefined ? null : description,
    occurredDate.toISOString(),
  ];

  try {
    const res = await pool.query(insertSql, values);
    return res.rows[0];
  } catch (err) {
    throw new AppError('DB_WRITE_FAILED', 'Unable to create transaction.', 500, { cause: err });
  }
}

module.exports = {
  listTransactions,
  createTransaction,
};
