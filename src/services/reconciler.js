import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';

const HIGH_PRIORITY_AMOUNT = 100;
const HIGH_PRIORITY_PCT = 10;

/**
 * Runs reconciliation for a given date and optional store.
 * Matches orders to cash reports, calculates variance, and upserts results.
 *
 * @param {string|null} date  - ISO date string (YYYY-MM-DD), or null for all dates
 * @param {string|null} storeId - store_id filter, or null for all stores
 * @returns {object} summary of reconciliation results
 */
export function reconcile(date = null, storeId = null) {
  const now = new Date().toISOString();

  // Fetch orders
  let orderQuery = 'SELECT * FROM orders WHERE 1=1';
  const orderParams = [];
  if (date) { orderQuery += ' AND pickup_date = ?'; orderParams.push(date); }
  if (storeId) { orderQuery += ' AND store_id = ?'; orderParams.push(storeId); }
  const orders = db.prepare(orderQuery).all(...orderParams);

  // Fetch cash reports
  let reportQuery = 'SELECT * FROM cash_reports WHERE 1=1';
  const reportParams = [];
  if (date) { reportQuery += ' AND report_date = ?'; reportParams.push(date); }
  if (storeId) { reportQuery += ' AND store_id = ?'; reportParams.push(storeId); }
  const reports = db.prepare(reportQuery).all(...reportParams);

  if (orders.length === 0) {
    return { reconciled: 0, matched: 0, over_collection: 0, under_collection: 0, unaccounted: 0, message: 'No orders found for the given filters' };
  }

  // Build lookup: order_id → report that claims it
  const orderToReport = {};
  for (const report of reports) {
    const claimedIds = JSON.parse(report.order_ids);
    for (const oid of claimedIds) {
      orderToReport[oid] = report;
    }
  }

  // Build lookup: (store_id + report_date) → report for aggregate comparison
  const reportByStoreDate = {};
  for (const report of reports) {
    const key = `${report.store_id}::${report.report_date}`;
    reportByStoreDate[key] = report;
  }

  // Group orders by (store_id + pickup_date)
  const ordersByStoreDate = {};
  for (const order of orders) {
    const key = `${order.store_id}::${order.pickup_date}`;
    if (!ordersByStoreDate[key]) ordersByStoreDate[key] = [];
    ordersByStoreDate[key].push(order);
  }

  const upsertStmt = db.prepare(`
    INSERT INTO reconciliations
      (id, order_id, report_id, store_id, reconciliation_date,
       expected_amount, actual_amount, variance_amount, variance_pct, status, is_high_priority, reconciled_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);

  // We use order_id as the logical unique key — delete existing before re-inserting
  const deleteByOrderId = db.prepare(`DELETE FROM reconciliations WHERE order_id = ? AND reconciliation_date = ?`);

  const counts = { matched: 0, over_collection: 0, under_collection: 0, unaccounted: 0 };

  const run = db.transaction(() => {
    for (const [key, storeOrders] of Object.entries(ordersByStoreDate)) {
      const [storeId, reconcDate] = key.split('::');
      const report = reportByStoreDate[key] || null;

      // Expected total for this store/day
      const expectedTotal = storeOrders.reduce((sum, o) => sum + o.expected_amount, 0);
      const actualTotal = report ? report.total_collected : null;

      for (const order of storeOrders) {
        deleteByOrderId.run(order.order_id, reconcDate);

        const claimingReport = orderToReport[order.order_id] || null;

        let status, varianceAmount, variancePct, actualAmount;

        if (!claimingReport) {
          // No cash report mentions this order at all
          status = 'unaccounted';
          actualAmount = null;
          varianceAmount = null;
          variancePct = null;
        } else {
          // Determine per-order actual: proportional share of total_collected
          // based on this order's share of the expected total for that report's store/day
          const reportOrders = storeOrders.filter(o => JSON.parse(claimingReport.order_ids).includes(o.order_id));
          const reportExpected = reportOrders.reduce((sum, o) => sum + o.expected_amount, 0);

          // If only one order or expected matches exactly, assign directly
          actualAmount = reportExpected > 0
            ? (order.expected_amount / reportExpected) * claimingReport.total_collected
            : claimingReport.total_collected;

          varianceAmount = round2(actualAmount - order.expected_amount);
          variancePct = order.expected_amount > 0
            ? round2((varianceAmount / order.expected_amount) * 100)
            : 0;

          if (Math.abs(varianceAmount) < 0.01) {
            status = 'matched';
          } else if (varianceAmount > 0) {
            status = 'over_collection';
          } else {
            status = 'under_collection';
          }
        }

        const isHighPriority = (
          status !== 'matched' && (
            Math.abs(varianceAmount ?? order.expected_amount) >= HIGH_PRIORITY_AMOUNT ||
            Math.abs(variancePct ?? 100) >= HIGH_PRIORITY_PCT
          )
        ) ? 1 : 0;

        counts[status]++;

        upsertStmt.run(
          uuidv4(),
          order.order_id,
          claimingReport?.report_id || null,
          storeId,
          reconcDate,
          round2(order.expected_amount),
          actualAmount !== null ? round2(actualAmount) : null,
          varianceAmount,
          variancePct,
          status,
          isHighPriority,
          now
        );
      }
    }
  });

  run();

  const total = orders.length;
  return {
    reconciled: total,
    ...counts,
    high_priority: db.prepare(`SELECT COUNT(*) as c FROM reconciliations WHERE is_high_priority = 1`).get().c,
    date: date || 'all',
    store_id: storeId || 'all',
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
