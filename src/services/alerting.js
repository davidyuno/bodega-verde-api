import { db } from '../db/index.js';

/**
 * Returns all high-priority reconciliation rows (is_high_priority = 1).
 * Optionally filters by date range and/or store_id.
 *
 * @param {object}  [opts]
 * @param {string}  [opts.from]     - ISO date YYYY-MM-DD lower bound (inclusive)
 * @param {string}  [opts.to]       - ISO date YYYY-MM-DD upper bound (inclusive)
 * @param {string}  [opts.store_id] - Limit results to a single store
 * @returns {Array<object>}         - Matching reconciliation records
 */
export function getHighPriorityAlerts({ from, to, store_id } = {}) {
  let sql = 'SELECT * FROM reconciliations WHERE is_high_priority = 1';
  const params = [];

  if (store_id) {
    sql += ' AND store_id = ?';
    params.push(store_id);
  }
  if (from) {
    sql += ' AND reconciliation_date >= ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND reconciliation_date <= ?';
    params.push(to);
  }

  sql += ' ORDER BY reconciliation_date DESC, store_id';

  return db.prepare(sql).all(...params);
}

/**
 * Determines whether a variance qualifies as high-priority.
 * High-priority when the absolute variance amount exceeds 100 MXN
 * OR the absolute variance percentage exceeds 10%.
 *
 * @param {number|null} varianceAmount - Variance in currency units (may be null)
 * @param {number|null} variancePct    - Variance as a percentage (may be null)
 * @returns {boolean}
 */
export function isHighPriority(varianceAmount, variancePct) {
  return Math.abs(varianceAmount ?? 0) > 100 || Math.abs(variancePct ?? 0) > 10;
}
