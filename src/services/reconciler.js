import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';

const HIGH_PRIORITY_AMOUNT = 100;
const HIGH_PRIORITY_PCT = 10;

/**
 * Round a number to 2 decimal places.
 * @param {number} n
 * @returns {number}
 */
function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Reconcile all orders whose pickup_date equals `date` (optionally scoped to
 * a single store).  The function performs a full re-reconciliation: it first
 * deletes every existing reconciliation row that matches the date + optional
 * store, then inserts fresh rows computed from the current orders and
 * cash_reports data.
 *
 * Algorithm
 * ---------
 * 1. Fetch orders WHERE pickup_date = date [AND store_id = store_id]
 * 2. Fetch cash_reports WHERE report_date = date [AND store_id = store_id]
 * 3. For each cash_report parse order_ids JSON and build a map
 *    order_id → report so we know which report "claims" each order.
 * 4. For each order:
 *    a. No claiming report → status = "unaccounted", actual/variance = null
 *    b. Report found →
 *       · Collect all orders listed in that report
 *       · proportional actual = (order.expected / sum_expected_in_report) * report.total_collected
 *       · variance_amount = actual - expected
 *       · variance_pct   = (variance_amount / expected) * 100
 *       · status: 0 → matched, >0 → over_collection, <0 → under_collection
 * 5. is_high_priority = |variance_amount| > 100 OR |variance_pct| > 10
 *    (always 0 for "unaccounted")
 * 6. INSERT all rows inside a single transaction.
 *
 * @param {string} date       - ISO date string YYYY-MM-DD
 * @param {string} [store_id] - Optional store filter
 * @returns {Array<object>}   - Array of reconciliation record objects that were inserted
 */
export function reconcileDate(date, store_id) {
  const now = new Date().toISOString();

  // ------------------------------------------------------------------
  // 1. Fetch orders for this date (+ optional store)
  // ------------------------------------------------------------------
  const orderParams = [date];
  let orderSql = 'SELECT * FROM orders WHERE pickup_date = ?';
  if (store_id) {
    orderSql += ' AND store_id = ?';
    orderParams.push(store_id);
  }
  const orders = db.prepare(orderSql).all(...orderParams);

  // ------------------------------------------------------------------
  // 2. Fetch cash_reports for this date (+ optional store)
  // ------------------------------------------------------------------
  const reportParams = [date];
  let reportSql = 'SELECT * FROM cash_reports WHERE report_date = ?';
  if (store_id) {
    reportSql += ' AND store_id = ?';
    reportParams.push(store_id);
  }
  const reports = db.prepare(reportSql).all(...reportParams);

  // ------------------------------------------------------------------
  // 3. Build order_id → report lookup
  //    Also pre-parse order_ids so we don't re-parse in the hot loop.
  // ------------------------------------------------------------------
  /** @type {Map<string, {report: object, parsedIds: string[]}>} */
  const reportMeta = new Map(); // report.report_id → { report, parsedIds }
  /** @type {Map<string, object>} */
  const orderToReport = new Map(); // order_id → report

  for (const report of reports) {
    let parsedIds;
    try {
      parsedIds = JSON.parse(report.order_ids);
    } catch {
      parsedIds = [];
    }
    reportMeta.set(report.report_id, { report, parsedIds });
    for (const oid of parsedIds) {
      // If multiple reports claim the same order_id the last one wins —
      // this mirrors simple cash-register practice (one report per store/day).
      orderToReport.set(oid, report);
    }
  }

  // ------------------------------------------------------------------
  // 4. Pre-compute "sum of expected amounts for orders inside each report"
  //    so proportional allocation is O(1) per order.
  // ------------------------------------------------------------------
  /** @type {Map<string, number>} report_id → sum of expected for its orders */
  const reportExpectedSum = new Map();

  for (const [reportId, { parsedIds }] of reportMeta) {
    let sum = 0;
    for (const oid of parsedIds) {
      // Find the order object by order_id
      const ord = orders.find(o => o.order_id === oid);
      if (ord) sum += ord.expected_amount;
    }
    reportExpectedSum.set(reportId, sum);
  }

  // ------------------------------------------------------------------
  // 5. Compute reconciliation record for every order
  // ------------------------------------------------------------------
  const records = [];

  for (const order of orders) {
    const claimingReport = orderToReport.get(order.order_id) ?? null;

    let status, actualAmount, varianceAmount, variancePct, reportId, isHighPriority;

    if (!claimingReport) {
      // No cash report references this order
      status = 'unaccounted';
      actualAmount = null;
      varianceAmount = null;
      variancePct = null;
      reportId = null;
      isHighPriority = 0;
    } else {
      reportId = claimingReport.report_id;
      const sumExpected = reportExpectedSum.get(reportId) ?? 0;

      // Proportional share of the report's collected total
      actualAmount = sumExpected > 0
        ? round2((order.expected_amount / sumExpected) * claimingReport.total_collected)
        : round2(claimingReport.total_collected);

      varianceAmount = round2(actualAmount - order.expected_amount);

      variancePct = order.expected_amount !== 0
        ? round2((varianceAmount / order.expected_amount) * 100)
        : 0;

      // Treat floating-point noise < 0.005 as zero (rounds to 0.00)
      if (Math.abs(varianceAmount) < 0.005) {
        varianceAmount = 0;
        variancePct = 0;
        status = 'matched';
      } else if (varianceAmount > 0) {
        status = 'over_collection';
      } else {
        status = 'under_collection';
      }

      isHighPriority =
        Math.abs(varianceAmount) > HIGH_PRIORITY_AMOUNT ||
        Math.abs(variancePct) > HIGH_PRIORITY_PCT
          ? 1
          : 0;
    }

    records.push({
      id: uuidv4(),
      order_id: order.order_id,
      report_id: reportId,
      store_id: order.store_id,
      reconciliation_date: date,
      expected_amount: round2(order.expected_amount),
      actual_amount: actualAmount,
      variance_amount: varianceAmount,
      variance_pct: variancePct,
      status,
      is_high_priority: isHighPriority,
      reconciled_at: now,
    });
  }

  // ------------------------------------------------------------------
  // 6. Delete stale rows and insert fresh ones inside a transaction
  // ------------------------------------------------------------------
  const deleteStmt = store_id
    ? db.prepare('DELETE FROM reconciliations WHERE reconciliation_date = ? AND store_id = ?')
    : db.prepare('DELETE FROM reconciliations WHERE reconciliation_date = ?');

  const insertStmt = db.prepare(`
    INSERT INTO reconciliations
      (id, order_id, report_id, store_id, reconciliation_date,
       expected_amount, actual_amount, variance_amount, variance_pct,
       status, is_high_priority, reconciled_at)
    VALUES
      (@id, @order_id, @report_id, @store_id, @reconciliation_date,
       @expected_amount, @actual_amount, @variance_amount, @variance_pct,
       @status, @is_high_priority, @reconciled_at)
  `);

  const runTransaction = db.transaction(() => {
    if (store_id) {
      deleteStmt.run(date, store_id);
    } else {
      deleteStmt.run(date);
    }
    for (const rec of records) {
      insertStmt.run(rec);
    }
  });

  runTransaction();

  return records;
}

/**
 * Reconcile every date in [from, to] inclusive, optionally scoped to one
 * store.  Iterates day-by-day and calls reconcileDate for each.
 *
 * @param {string} from       - ISO date string YYYY-MM-DD (start, inclusive)
 * @param {string} to         - ISO date string YYYY-MM-DD (end, inclusive)
 * @param {string} [store_id] - Optional store filter
 * @returns {Array<object>}   - Flat array of all reconciliation records produced
 */
export function reconcileDateRange(from, to, store_id) {
  const allRecords = [];

  // Advance day-by-day through the range using UTC midnight to avoid DST drift
  const current = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);

  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10);
    const dayRecords = reconcileDate(dateStr, store_id);
    allRecords.push(...dayRecords);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return allRecords;
}
