import { Router } from 'express';
import { reconcile } from '../services/reconciler.js';
import { db } from '../db/index.js';

const router = Router();

/**
 * @swagger
 * /api/reconcile:
 *   post:
 *     summary: Trigger reconciliation for a date or all data
 *     tags: [Reconciliation]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 example: "2024-01-15"
 *               store_id:
 *                 type: string
 *                 example: "CDMX-001"
 *     responses:
 *       200:
 *         description: Reconciliation summary
 */
router.post('/', (req, res, next) => {
  try {
    const { date, store_id } = req.body || {};
    const result = reconcile(date || null, store_id || null);
    res.json({ success: true, result });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/reconcile/batch:
 *   post:
 *     summary: Reconcile a date range (batch)
 *     tags: [Reconciliation]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [from, to]
 *             properties:
 *               from:
 *                 type: string
 *                 example: "2024-01-15"
 *               to:
 *                 type: string
 *                 example: "2024-01-19"
 *               store_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Batch reconciliation summary per day
 */
router.post('/batch', (req, res, next) => {
  try {
    const { from, to, store_id } = req.body || {};
    if (!from || !to) {
      return res.status(400).json({ success: false, error: '"from" and "to" dates are required' });
    }

    const dates = getDatesInRange(from, to);
    const results = dates.map(date => ({
      date,
      ...reconcile(date, store_id || null),
    }));

    const totals = results.reduce((acc, r) => {
      acc.reconciled += r.reconciled;
      acc.matched += r.matched;
      acc.over_collection += r.over_collection;
      acc.under_collection += r.under_collection;
      acc.unaccounted += r.unaccounted;
      return acc;
    }, { reconciled: 0, matched: 0, over_collection: 0, under_collection: 0, unaccounted: 0 });

    res.json({ success: true, from, to, daily: results, totals });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/reconciliation/summary:
 *   get:
 *     summary: Reconciliation summary for a date range
 *     tags: [Reconciliation]
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string }
 *         example: "2024-01-15"
 *       - in: query
 *         name: to
 *         schema: { type: string }
 *         example: "2024-01-19"
 *       - in: query
 *         name: store_id
 *         schema: { type: string }
 *       - in: query
 *         name: region
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Summary stats grouped by store and date
 */
router.get('/summary', (req, res, next) => {
  try {
    const { from, to, store_id, region } = req.query;

    let query = `
      SELECT
        r.store_id,
        r.reconciliation_date,
        COUNT(*) as total_orders,
        SUM(CASE WHEN r.status = 'matched' THEN 1 ELSE 0 END) as matched,
        SUM(CASE WHEN r.status = 'over_collection' THEN 1 ELSE 0 END) as over_collection,
        SUM(CASE WHEN r.status = 'under_collection' THEN 1 ELSE 0 END) as under_collection,
        SUM(CASE WHEN r.status = 'unaccounted' THEN 1 ELSE 0 END) as unaccounted,
        SUM(r.expected_amount) as total_expected,
        SUM(COALESCE(r.actual_amount, 0)) as total_actual,
        SUM(COALESCE(r.variance_amount, -r.expected_amount)) as total_variance,
        SUM(r.is_high_priority) as high_priority_count
      FROM reconciliations r
    `;

    const conditions = [];
    const params = [];

    if (store_id) { conditions.push('r.store_id = ?'); params.push(store_id); }
    if (from) { conditions.push('r.reconciliation_date >= ?'); params.push(from); }
    if (to) { conditions.push('r.reconciliation_date <= ?'); params.push(to); }

    if (region) {
      query += ` JOIN orders o ON r.order_id = o.order_id`;
      conditions.push('o.region = ?');
      params.push(region);
    }

    if (conditions.length > 0) query += ` WHERE ${conditions.join(' AND ')}`;
    query += ` GROUP BY r.store_id, r.reconciliation_date ORDER BY r.reconciliation_date, r.store_id`;

    const rows = db.prepare(query).all(...params);

    const totals = rows.reduce((acc, r) => {
      acc.total_orders += r.total_orders;
      acc.matched += r.matched;
      acc.over_collection += r.over_collection;
      acc.under_collection += r.under_collection;
      acc.unaccounted += r.unaccounted;
      acc.total_expected = round2((acc.total_expected || 0) + r.total_expected);
      acc.total_actual = round2((acc.total_actual || 0) + r.total_actual);
      acc.total_variance = round2((acc.total_variance || 0) + r.total_variance);
      return acc;
    }, { total_orders: 0, matched: 0, over_collection: 0, under_collection: 0, unaccounted: 0 });

    res.json({ success: true, summary: rows, totals });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/reconciliation/discrepancies:
 *   get:
 *     summary: List all discrepancies with optional filters
 *     tags: [Reconciliation]
 *     parameters:
 *       - in: query
 *         name: min_variance
 *         schema: { type: number }
 *         description: Minimum absolute variance in MXN
 *         example: 100
 *       - in: query
 *         name: store_id
 *         schema: { type: string }
 *       - in: query
 *         name: from
 *         schema: { type: string }
 *       - in: query
 *         name: to
 *         schema: { type: string }
 *       - in: query
 *         name: priority
 *         schema: { type: boolean }
 *         description: If true, return only high-priority discrepancies
 *     responses:
 *       200:
 *         description: List of discrepancies
 */
router.get('/discrepancies', (req, res, next) => {
  try {
    const { min_variance, store_id, from, to, priority } = req.query;

    let query = `SELECT * FROM reconciliations WHERE status != 'matched'`;
    const params = [];

    if (priority === 'true') { query += ` AND is_high_priority = 1`; }
    if (store_id) { query += ` AND store_id = ?`; params.push(store_id); }
    if (from) { query += ` AND reconciliation_date >= ?`; params.push(from); }
    if (to) { query += ` AND reconciliation_date <= ?`; params.push(to); }
    if (min_variance) {
      query += ` AND ABS(COALESCE(variance_amount, expected_amount)) >= ?`;
      params.push(parseFloat(min_variance));
    }

    query += ` ORDER BY ABS(COALESCE(variance_amount, expected_amount)) DESC`;

    const rows = db.prepare(query).all(...params);
    res.json({ success: true, count: rows.length, discrepancies: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/reconciliation/status:
 *   get:
 *     summary: Per-order reconciliation status list
 *     tags: [Reconciliation]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema: { type: string }
 *         example: "2024-01-15"
 *       - in: query
 *         name: store_id
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [matched, over_collection, under_collection, unaccounted] }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Paginated list of reconciliation records
 */
router.get('/status', (req, res, next) => {
  try {
    const { date, store_id, status, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `SELECT * FROM reconciliations WHERE 1=1`;
    const params = [];

    if (date) { query += ` AND reconciliation_date = ?`; params.push(date); }
    if (store_id) { query += ` AND store_id = ?`; params.push(store_id); }
    if (status) { query += ` AND status = ?`; params.push(status); }

    query += ` ORDER BY reconciliation_date DESC, store_id LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const rows = db.prepare(query).all(...params);
    res.json({ success: true, page: parseInt(page), limit: parseInt(limit), count: rows.length, records: rows });
  } catch (err) {
    next(err);
  }
});

function getDatesInRange(from, to) {
  const dates = [];
  const current = new Date(from);
  const end = new Date(to);
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

export default router;
