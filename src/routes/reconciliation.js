import { Router } from 'express';
import { db } from '../db/index.js';
import { reconcileDate, reconcileDateRange } from '../services/reconciler.js';

const router = Router();

// ---------------------------------------------------------------------------
// POST /api/reconcile
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/reconcile:
 *   post:
 *     summary: Trigger reconciliation for a specific date or for all available dates
 *     tags: [Reconciliation]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 description: ISO date to reconcile (YYYY-MM-DD). Omit to reconcile all dates.
 *                 example: "2024-01-15"
 *               store_id:
 *                 type: string
 *                 description: Limit reconciliation to one store. Only relevant when date is provided.
 *                 example: "CDMX-001"
 *     responses:
 *       200:
 *         description: Reconciliation completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 reconciled:
 *                   type: integer
 *                   description: Number of reconciliation records produced
 *                 records:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.post('/reconcile', async (req, res, next) => {
  try {
    const { date, store_id } = req.body || {};

    let records = [];

    if (!date) {
      // Reconcile every distinct pickup_date found in the orders table
      const dates = db
        .prepare('SELECT DISTINCT pickup_date FROM orders ORDER BY pickup_date')
        .all()
        .map(r => r.pickup_date);

      for (const d of dates) {
        const dayRecords = reconcileDate(d, store_id || undefined);
        records.push(...dayRecords);
      }
    } else {
      records = reconcileDate(date, store_id || undefined);
    }

    res.json({
      success: true,
      message: date
        ? `Reconciled ${records.length} orders for date ${date}${store_id ? ` / store ${store_id}` : ''}`
        : `Reconciled ${records.length} orders across all dates`,
      reconciled: records.length,
      records,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/reconcile/batch
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/reconcile/batch:
 *   post:
 *     summary: Reconcile a date range in a single request
 *     tags: [Reconciliation]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - from
 *               - to
 *             properties:
 *               from:
 *                 type: string
 *                 format: date
 *                 description: Start date inclusive (YYYY-MM-DD)
 *                 example: "2024-01-15"
 *               to:
 *                 type: string
 *                 format: date
 *                 description: End date inclusive (YYYY-MM-DD)
 *                 example: "2024-01-19"
 *               store_id:
 *                 type: string
 *                 description: Optionally limit to one store
 *                 example: "CDMX-001"
 *     responses:
 *       200:
 *         description: Batch reconciliation completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 reconciled:
 *                   type: integer
 *                 records:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Validation error — from and to are required, and from must be <= to
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 */
router.post('/reconcile/batch', (req, res, next) => {
  try {
    const { from, to, store_id } = req.body || {};

    if (!from || !to) {
      return res.status(400).json({
        success: false,
        error: '"from" and "to" date fields are required',
      });
    }

    if (from > to) {
      return res.status(400).json({
        success: false,
        error: '"from" date must be less than or equal to "to" date',
      });
    }

    const records = reconcileDateRange(from, to, store_id || undefined);

    res.json({
      success: true,
      message: `Reconciled ${records.length} orders from ${from} to ${to}${store_id ? ` for store ${store_id}` : ''}`,
      reconciled: records.length,
      records,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/reconciliation/summary
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/reconciliation/summary:
 *   get:
 *     summary: Aggregated reconciliation summary grouped by store and date
 *     tags: [Reconciliation]
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date inclusive (YYYY-MM-DD)
 *         example: "2024-01-15"
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *         description: End date inclusive (YYYY-MM-DD)
 *         example: "2024-01-19"
 *       - in: query
 *         name: store_id
 *         schema:
 *           type: string
 *         description: Filter by store
 *         example: "CDMX-001"
 *       - in: query
 *         name: region
 *         schema:
 *           type: string
 *         description: Filter by region (requires JOIN with orders table)
 *         example: "cdmx"
 *     responses:
 *       200:
 *         description: Summary grouped by store_id and reconciliation_date
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       store_id:
 *                         type: string
 *                       region:
 *                         type: string
 *                       date:
 *                         type: string
 *                       total_orders:
 *                         type: integer
 *                       matched:
 *                         type: integer
 *                       over_collection:
 *                         type: integer
 *                       under_collection:
 *                         type: integer
 *                       unaccounted:
 *                         type: integer
 *                       total_expected:
 *                         type: number
 *                       total_actual:
 *                         type: number
 *                       total_variance:
 *                         type: number
 *                       high_priority_count:
 *                         type: integer
 */
router.get('/reconciliation/summary', (req, res, next) => {
  try {
    const { from, to, store_id, region } = req.query;

    const conditions = [];
    const params = [];

    if (store_id) {
      conditions.push('r.store_id = ?');
      params.push(store_id);
    }
    if (from) {
      conditions.push('r.reconciliation_date >= ?');
      params.push(from);
    }
    if (to) {
      conditions.push('r.reconciliation_date <= ?');
      params.push(to);
    }
    if (region) {
      conditions.push('o.region = ?');
      params.push(region);
    }

    // When filtering by region we must JOIN with orders; otherwise a plain
    // query on reconciliations is sufficient and more efficient.
    const joinClause = region
      ? 'JOIN orders o ON r.order_id = o.order_id'
      : '';

    // Include region in the SELECT + GROUP BY only when it is filtered/needed
    const regionSelect = region ? ', o.region AS region' : '';
    const regionGroup = region ? ', o.region' : '';

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const sql = `
      SELECT
        r.store_id,
        r.reconciliation_date                                          AS date
        ${regionSelect},
        COUNT(*)                                                       AS total_orders,
        SUM(CASE WHEN r.status = 'matched'          THEN 1 ELSE 0 END) AS matched,
        SUM(CASE WHEN r.status = 'over_collection'  THEN 1 ELSE 0 END) AS over_collection,
        SUM(CASE WHEN r.status = 'under_collection' THEN 1 ELSE 0 END) AS under_collection,
        SUM(CASE WHEN r.status = 'unaccounted'      THEN 1 ELSE 0 END) AS unaccounted,
        ROUND(SUM(r.expected_amount), 2)                               AS total_expected,
        ROUND(SUM(COALESCE(r.actual_amount, 0)), 2)                    AS total_actual,
        ROUND(SUM(COALESCE(r.variance_amount, 0)), 2)                  AS total_variance,
        SUM(r.is_high_priority)                                        AS high_priority_count
      FROM reconciliations r
      ${joinClause}
      ${whereClause}
      GROUP BY r.store_id, r.reconciliation_date${regionGroup}
      ORDER BY r.reconciliation_date, r.store_id
    `;

    const data = db.prepare(sql).all(...params);

    res.json({ data });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/reconciliation/discrepancies
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/reconciliation/discrepancies:
 *   get:
 *     summary: List non-matched reconciliation records with optional filters
 *     tags: [Reconciliation]
 *     parameters:
 *       - in: query
 *         name: min_variance
 *         schema:
 *           type: number
 *         description: Minimum absolute variance amount in MXN
 *         example: 50
 *       - in: query
 *         name: store_id
 *         schema:
 *           type: string
 *         example: "CDMX-001"
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *         example: "2024-01-15"
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *         example: "2024-01-19"
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: ["true", "false"]
 *         description: When "true", return only high-priority discrepancies
 *         example: "true"
 *     responses:
 *       200:
 *         description: Discrepancy records ordered by absolute variance descending
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 count:
 *                   type: integer
 */
router.get('/reconciliation/discrepancies', (req, res, next) => {
  try {
    const { min_variance, store_id, from, to, priority } = req.query;

    let sql = "SELECT * FROM reconciliations WHERE status != 'matched'";
    const params = [];

    if (priority === 'true') {
      sql += ' AND is_high_priority = 1';
    }
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
    if (min_variance !== undefined && min_variance !== '') {
      sql += ' AND ABS(variance_amount) >= ?';
      params.push(parseFloat(min_variance));
    }

    sql += ' ORDER BY ABS(COALESCE(variance_amount, expected_amount)) DESC';

    const data = db.prepare(sql).all(...params);

    res.json({ data, count: data.length });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/reconciliation/status
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /api/reconciliation/status:
 *   get:
 *     summary: Per-order reconciliation status list with optional filters
 *     tags: [Reconciliation]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by reconciliation date (YYYY-MM-DD)
 *         example: "2024-01-15"
 *       - in: query
 *         name: store_id
 *         schema:
 *           type: string
 *         example: "CDMX-001"
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [matched, over_collection, under_collection, unaccounted]
 *         description: Filter by reconciliation status
 *     responses:
 *       200:
 *         description: Reconciliation records ordered by date desc then store
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 count:
 *                   type: integer
 */
router.get('/reconciliation/status', (req, res, next) => {
  try {
    const { date, store_id, status } = req.query;

    let sql = 'SELECT * FROM reconciliations WHERE 1=1';
    const params = [];

    if (date) {
      sql += ' AND reconciliation_date = ?';
      params.push(date);
    }
    if (store_id) {
      sql += ' AND store_id = ?';
      params.push(store_id);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY reconciliation_date DESC, store_id';

    const data = db.prepare(sql).all(...params);

    res.json({ data, count: data.length });
  } catch (err) {
    next(err);
  }
});

export default router;
