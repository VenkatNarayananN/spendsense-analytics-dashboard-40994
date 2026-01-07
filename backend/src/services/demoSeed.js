'use strict';

const crypto = require('crypto');
const { getPool } = require('../db/pool');
const { AppError, ValidationError } = require('../errors/AppError');

const DEFAULT_COUNT = 75;
const MIN_COUNT = 1;
const MAX_COUNT = 300;

/**
 * @param {number} n
 * @returns {number}
 */
function _clampCount(n) {
  return Math.max(MIN_COUNT, Math.min(MAX_COUNT, n));
}

/**
 * @param {unknown} v
 * @returns {number|null}
 */
function _parseOptionalInt(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.floor(n);
}

/**
 * @returns {string} YYYY-MM-DD in UTC
 */
function _todayUtcYmd() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Deterministic marker per user+day. Used to avoid duplication.
 * @param {string} userId
 * @param {string} ymd
 * @returns {string}
 */
function _marker(userId, ymd) {
  // Keep it short-ish but unique.
  const digest = crypto.createHash('sha256').update(`${userId}|${ymd}|demo-seed`).digest('hex');
  return `demo-seed:${ymd}:${digest.slice(0, 16)}`;
}

/**
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function _rand(min, max) {
  return Math.random() * (max - min) + min;
}

/**
 * Choose a random integer in [min,max]
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function _randInt(min, max) {
  return Math.floor(_rand(min, max + 1));
}

/**
 * @template T
 * @param {T[]} arr
 * @returns {T}
 */
function _pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate a realistic amount distribution based on category.
 * @param {string} category
 * @returns {number}
 */
function _generateAmount(category) {
  // Amounts are positive numbers (spend). Keep within typical ranges.
  switch (category) {
    case 'Groceries':
      return Number(_rand(8, 120).toFixed(2));
    case 'Dining':
      return Number(_rand(10, 70).toFixed(2));
    case 'Transport':
      return Number(_rand(2.5, 45).toFixed(2));
    case 'Shopping':
      return Number(_rand(12, 250).toFixed(2));
    case 'Entertainment':
      return Number(_rand(5, 80).toFixed(2));
    case 'Bills':
      return Number(_rand(20, 220).toFixed(2));
    case 'Health':
      return Number(_rand(10, 160).toFixed(2));
    case 'Travel':
      return Number(_rand(30, 600).toFixed(2));
    default:
      return Number(_rand(5, 100).toFixed(2));
  }
}

/**
 * Create an ISO timestamp within the last N days (with some clustering on recent days).
 * @param {number} daysBackMax
 * @returns {string}
 */
function _randomOccurredAt(daysBackMax) {
  const now = new Date();

  // Bias towards more recent days: square distribution.
  const t = Math.random();
  const biased = t * t; // more weight near 0
  const daysBack = Math.floor(biased * daysBackMax);

  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - daysBack);

  // Random time during day
  d.setUTCHours(_randInt(7, 22), _randInt(0, 59), _randInt(0, 59), 0);
  return d.toISOString();
}

/**
 * PUBLIC_INTERFACE
 * Seed demo data (transactions and alerts) for a single user.
 *
 * Idempotency:
 * - For a given user and UTC day, the service uses a deterministic marker.
 * - If any rows already exist with that marker (via `description` for tx and `message` for alerts),
 *   the seed operation is skipped (returns inserted counts 0).
 *
 * IMPORTANT: This is scoped to the authenticated user only; caller must supply userId
 * derived from auth context (server-enforced).
 *
 * @param {object} params
 * @param {string} params.userId
 * @param {any} params.body
 * @returns {Promise<{ inserted: { transactions: number, alerts: number } }>}
 */
async function seedDemoDataForUser({ userId, body }) {
  const countRaw = _parseOptionalInt(body && body.count);
  const count = _clampCount(countRaw === null ? DEFAULT_COUNT : countRaw);

  if (countRaw !== null && (!Number.isFinite(countRaw) || countRaw < MIN_COUNT || countRaw > MAX_COUNT)) {
    throw new ValidationError(`Field "count" must be an integer between ${MIN_COUNT} and ${MAX_COUNT}.`);
  }

  const ymd = _todayUtcYmd();
  const marker = _marker(userId, ymd);

  const pool = getPool();

  // Ensure user exists (best-effort, consistent with other services).
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
    throw new AppError('DB_WRITE_FAILED', 'Unable to seed demo data.', 500, { cause: err });
  }

  // Idempotency check: if we've already created any marked rows for this user today, skip entirely.
  // (We use description/message markers to avoid needing schema changes.)
  try {
    const txCheck = await pool.query(
      `
      SELECT 1
      FROM transactions
      WHERE user_id = $1
        AND description = $2
      LIMIT 1
      `,
      [userId, marker]
    );

    const alertCheck = await pool.query(
      `
      SELECT 1
      FROM alerts
      WHERE user_id = $1
        AND message LIKE $2
      LIMIT 1
      `,
      [userId, `${marker}%`]
    );

    const alreadySeeded = (txCheck.rows && txCheck.rows.length > 0) || (alertCheck.rows && alertCheck.rows.length > 0);
    if (alreadySeeded) {
      return { inserted: { transactions: 0, alerts: 0 } };
    }
  } catch (err) {
    throw new AppError('DB_READ_FAILED', 'Unable to seed demo data.', 500, { cause: err });
  }

  const categories = [
    {
      category: 'Groceries',
      merchants: ['Whole Foods', 'Trader Joe’s', 'Kroger', 'Target', 'Costco'],
      descriptionTemplates: ['Weekly groceries', 'Pantry restock', 'Fresh produce'],
    },
    {
      category: 'Dining',
      merchants: ['Starbucks', 'Chipotle', 'Sweetgreen', 'Local Bistro', 'Shake Shack'],
      descriptionTemplates: ['Lunch', 'Coffee', 'Dinner with friends', 'Quick bite'],
    },
    {
      category: 'Transport',
      merchants: ['Uber', 'Lyft', 'Shell', 'Exxon', 'Metro'],
      descriptionTemplates: ['Ride share', 'Fuel', 'Transit pass', 'Commute'],
    },
    {
      category: 'Shopping',
      merchants: ['Amazon', 'Apple', 'Best Buy', 'Etsy', 'Uniqlo'],
      descriptionTemplates: ['Online order', 'Accessories', 'Household items', 'New gadget'],
    },
    {
      category: 'Entertainment',
      merchants: ['Netflix', 'Spotify', 'AMC Theatres', 'Steam', 'Hulu'],
      descriptionTemplates: ['Subscription', 'Movie night', 'Game purchase'],
    },
    {
      category: 'Bills',
      merchants: ['Comcast', 'Verizon', 'City Utilities', 'Rent', 'Insurance Co.'],
      descriptionTemplates: ['Monthly bill', 'Utilities', 'Internet', 'Phone'],
    },
    {
      category: 'Health',
      merchants: ['CVS', 'Walgreens', 'Local Clinic', 'Gym Membership', 'Optometry'],
      descriptionTemplates: ['Pharmacy', 'Checkup', 'Membership', 'Vitamins'],
    },
    {
      category: 'Travel',
      merchants: ['Delta', 'Marriott', 'Airbnb', 'Booking.com', 'Amtrak'],
      descriptionTemplates: ['Trip booking', 'Hotel stay', 'Train ticket', 'Flight'],
    },
  ];

  /** @type {Array<{ amount: number, currency: string, category: string, merchant: string, description: string|null, occurred_at: string }>} */
  const txs = [];
  for (let i = 0; i < count; i += 1) {
    const cat = _pick(categories);
    const merchant = _pick(cat.merchants);
    const occurred_at = _randomOccurredAt(21);

    // Use marker in description field for idempotency. Keep it exact marker to query quickly.
    // Realistic description is optional; existing API allows null.
    // We'll keep marker exact and rely on merchant/category/amount/time for realism.
    const description = marker;

    const amount = _generateAmount(cat.category);

    txs.push({
      amount,
      currency: 'USD',
      category: cat.category,
      merchant,
      description,
      occurred_at,
    });
  }

  // A few alerts that look plausible for a demo.
  const alerts = [
    {
      type: 'budget',
      message: `${marker} Spending threshold: You’ve spent more than $250 on Dining in the last 7 days.`,
      status: 'active',
    },
    {
      type: 'unusual',
      message: `${marker} Unusual activity: A larger-than-usual charge was detected at ${_pick([
        'Amazon',
        'Apple',
        'Best Buy',
        'Marriott',
      ])}.`,
      status: 'active',
    },
    {
      type: 'insight',
      message: `${marker} Insight: Groceries are trending up this week compared to last week.`,
      status: 'active',
    },
  ];

  // Insert inside a transaction so we don't partially seed.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert transactions individually (keeps logic straightforward and easy to test/mutate later).
    // This is not the most performant, but it's fine for demo seeding sizes.
    let insertedTransactions = 0;
    for (const t of txs) {
      await client.query(
        `
        INSERT INTO transactions
          (user_id, amount, currency, category, merchant, description, occurred_at)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7)
        `,
        [userId, t.amount, t.currency, t.category, t.merchant, t.description, t.occurred_at]
      );
      insertedTransactions += 1;
    }

    let insertedAlerts = 0;
    for (const a of alerts) {
      await client.query(
        `
        INSERT INTO alerts (user_id, type, message, status)
        VALUES ($1, $2, $3, $4)
        `,
        [userId, a.type, a.message, a.status]
      );
      insertedAlerts += 1;
    }

    await client.query('COMMIT');
    return { inserted: { transactions: insertedTransactions, alerts: insertedAlerts } };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback failures
    }
    throw new AppError('DB_WRITE_FAILED', 'Unable to seed demo data.', 500, { cause: err });
  } finally {
    client.release();
  }
}

module.exports = {
  seedDemoDataForUser,
};
