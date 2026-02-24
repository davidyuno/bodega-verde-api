import { Router } from 'express';
import { db } from '../db/index.js';

const router = Router();

/**
 * @swagger
 * /api/analytics/stores:
 *   get:
 *     summary: Discrepancy rates and trends per store
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string }
 *         example: "2024-01-15"
 *       - in: query
 *         name: to
 *         schema: { type: string }
 *         example: "2024-01-19"
 *     responses:
 *       200:
 *         description: Per-store accuracy and discrepancy statistics
 */
router.get('/stores', (req, res, next) => {
  try {
    const { from, to } = req.query;

    let query = `
      SELECT
        store_id,
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'matched' THEN 1 ELSE 0 END) as matched,
        SUM(CASE WHEN status != 'matched' THEN 1 ELSE 0 END) as discrepancies,
        ROUND(SUM(CASE WHEN status = 'matched' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as accuracy_pct,
        SUM(is_high_priority) as high_priority_count,
        ROUND(SUM(expected_amount), 2) as total_expected,
        ROUND(SUM(COALESCE(actual_amount, 0)), 2) as total_actual,
        ROUND(SUM(COALESCE(variance_amount, -expected_amount)), 2) as total_variance
      FROM reconciliations
      WHERE 1=1
    `;
    const params = [];

    if (from) { query += ` AND reconciliation_date >= ?`; params.push(from); }
    if (to) { query += ` AND reconciliation_date <= ?`; params.push(to); }

    query += ` GROUP BY store_id ORDER BY accuracy_pct ASC`;

    const rows = db.prepare(query).all(...params);
    res.json({ success: true, stores: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/analytics/daily:
 *   get:
 *     summary: Daily accuracy trend across all stores
 *     tags: [Analytics]
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
 *     responses:
 *       200:
 *         description: Per-day accuracy stats
 */
router.get('/daily', (req, res, next) => {
  try {
    const { from, to, store_id } = req.query;

    let query = `
      SELECT
        reconciliation_date,
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'matched' THEN 1 ELSE 0 END) as matched,
        SUM(CASE WHEN status != 'matched' THEN 1 ELSE 0 END) as discrepancies,
        ROUND(SUM(CASE WHEN status = 'matched' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as accuracy_pct,
        SUM(is_high_priority) as high_priority_count,
        ROUND(SUM(expected_amount), 2) as total_expected,
        ROUND(SUM(COALESCE(actual_amount, 0)), 2) as total_actual,
        ROUND(SUM(COALESCE(variance_amount, -expected_amount)), 2) as total_variance
      FROM reconciliations
      WHERE 1=1
    `;
    const params = [];

    if (store_id) { query += ` AND store_id = ?`; params.push(store_id); }
    if (from) { query += ` AND reconciliation_date >= ?`; params.push(from); }
    if (to) { query += ` AND reconciliation_date <= ?`; params.push(to); }

    query += ` GROUP BY reconciliation_date ORDER BY reconciliation_date ASC`;

    const rows = db.prepare(query).all(...params);
    res.json({ success: true, daily: rows });
  } catch (err) {
    next(err);
  }
});

export default router;
