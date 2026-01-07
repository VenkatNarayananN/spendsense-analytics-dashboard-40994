'use strict';

const { getPool } = require('../db/pool');
const { AppError, ValidationError } = require('../errors/AppError');

/**
 * @param {string} s
 * @returns {Date|null}
 */
function _parseDate(s) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/**
 * PUBLIC_INTERFACE
 * Compute a summary KPI payload for a user's transactions over an optional date range.
 *
 * KPIs:
 * - total_spend
 * - average_daily_spend
 * - top_categories (top 5)
 * - recent_merchants (most recent 5 merchants, unique)
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {any} params.query
 * @returns {Promise<any>}
 */
async function getSummary({ userId, query }) {
  const fromRaw = query && typeof query.from === 'string' ? query.from.trim() : undefined;
  const toRaw = query && typeof query.to === 'string' ? query.to.trim() : undefined;

  let from = undefined;
  let to = undefined;

  if (fromRaw) {
    const d = _parseDate(fromRaw);
    if (!d) throw new ValidationError('Query param "from" must be a valid date/time string.');
    from = d.toISOString();
  }
  if (toRaw) {
    const d = _parseDate(toRaw);
    if (!d) throw new ValidationError('Query param "to" must be a valid date/time string.');
    to = d.toISOString();
  }

  const pool = getPool();

  const where = ['user_id = $1'];
  const values = [userId];
  let idx = values.length;

  if (from) {
    idx += 1;
    where.push(`occurred_at >= $${idx}`);
    values.push(from);
  }
  if (to) {
    idx += 1;
    where.push(`occurred_at <= $${idx}`);
    values.push(to);
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;

  try {
    const totalRes = await pool.query(
      `
      SELECT COALESCE(SUM(amount), 0)::float AS total_spend,
             MIN(occurred_at) AS min_date,
             MAX(occurred_at) AS max_date,
             COUNT(*)::int AS count
      FROM transactions
      ${whereSql}
      `,
      values
    );

    const totalSpend = Number(totalRes.rows[0].total_spend || 0);
    const minDate = totalRes.rows[0].min_date ? new Date(totalRes.rows[0].min_date) : null;
    const maxDate = totalRes.rows[0].max_date ? new Date(totalRes.rows[0].max_date) : null;

    let dayCount = 0;
    if (minDate && maxDate) {
      // Inclusive days: floor((max - min)/day)+1
      const ms = maxDate.getTime() - minDate.getTime();
      dayCount = Math.floor(ms / (24 * 60 * 60 * 1000)) + 1;
    }
    const averageDailySpend = dayCount > 0 ? totalSpend / dayCount : 0;

    const topCategoriesRes = await pool.query(
      `
      SELECT category, COALESCE(SUM(amount), 0)::float AS total
      FROM transactions
      ${whereSql}
      GROUP BY category
      ORDER BY total DESC
      LIMIT 5
      `,
      values
    );

    const recentMerchantsRes = await pool.query(
      `
      SELECT merchant
      FROM transactions
      ${whereSql}
      ORDER BY occurred_at DESC, created_at DESC
      LIMIT 50
      `,
      values
    );

    const recentMerchants = [];
    const seen = new Set();
    for (const row of recentMerchantsRes.rows || []) {
      const m = row.merchant;
      if (!m || typeof m !== 'string') continue;
      const key = m.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      recentMerchants.push(key);
      if (recentMerchants.length >= 5) break;
    }

    return {
      total_spend: totalSpend,
      average_daily_spend: averageDailySpend,
      top_categories: (topCategoriesRes.rows || []).map((r) => ({
        category: r.category,
        total: Number(r.total || 0),
      })),
      recent_merchants: recentMerchants,
      range: {
        from: fromRaw || null,
        to: toRaw || null,
      },
    };
  } catch (err) {
    throw new AppError('DB_READ_FAILED', 'Unable to compute analytics summary.', 500, {
      cause: err,
    });
  }
}

module.exports = {
  getSummary,
};
