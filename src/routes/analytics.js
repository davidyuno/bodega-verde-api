import { Router } from 'express';
import { db } from '../db/index.js';

const router = Router();

/**
 * @swagger
 * /api/analytics/stores:
 *   get:
 *     summary: Discrepancy rates and trends per store over time
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *         description: Start date (YYYY-MM-DD)
 *         example: "2024-01-15"
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *         description: End date (YYYY-MM-DD)
 *         example: "2024-01-19"
 *     responses:
 *       200:
 *         description: Per-store accuracy and discrepancy statistics
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
 *                       total_orders:
 *                         type: integer
 *                       matched:
 *                         type: integer
 *                       discrepancies:
 *                         type: integer
 *                       total_variance:
 *                         type: number
 *                       avg_variance_pct:
 *                         type: number
 *                       discrepancy_rate:
 *                         type: number
 */
router.get('/stores', (req, res, next) => {
  try {
    const { from, to } = req.query;

    const conditions = [];
    const params = [];

    if (from) { conditions.push('reconciliation_date >= ?'); params.push(from); }
    if (to) { conditions.push('reconciliation_date <= ?'); params.push(to); }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT
        store_id,
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'matched' THEN 1 ELSE 0 END) as matched,
        SUM(CASE WHEN status != 'matched' THEN 1 ELSE 0 END) as discrepancies,
        ROUND(SUM(COALESCE(variance_amount, -expected_amount)), 2) as total_variance,
        ROUND(AVG(COALESCE(ABS(variance_pct), 0)), 2) as avg_variance_pct,
        ROUND(
          SUM(CASE WHEN status != 'matched' THEN 1 ELSE 0 END) * 100.0 / COUNT(*),
          2
        ) as discrepancy_rate
      FROM reconciliations
      ${whereClause}
      GROUP BY store_id
      ORDER BY discrepancy_rate DESC
    `;

    const data = db.prepare(query).all(...params);

    res.json({ data });
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
 *         schema:
 *           type: string
 *         description: Start date (YYYY-MM-DD)
 *         example: "2024-01-15"
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *         description: End date (YYYY-MM-DD)
 *         example: "2024-01-19"
 *       - in: query
 *         name: store_id
 *         schema:
 *           type: string
 *         description: Filter by store ID
 *     responses:
 *       200:
 *         description: Per-day accuracy stats
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
 *                       date:
 *                         type: string
 *                       total_orders:
 *                         type: integer
 *                       matched:
 *                         type: integer
 *                       discrepancies:
 *                         type: integer
 *                       total_variance:
 *                         type: number
 *                       accuracy_rate:
 *                         type: number
 */
router.get('/daily', (req, res, next) => {
  try {
    const { from, to, store_id } = req.query;

    const conditions = [];
    const params = [];

    if (store_id) { conditions.push('store_id = ?'); params.push(store_id); }
    if (from) { conditions.push('reconciliation_date >= ?'); params.push(from); }
    if (to) { conditions.push('reconciliation_date <= ?'); params.push(to); }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT
        reconciliation_date as date,
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'matched' THEN 1 ELSE 0 END) as matched,
        SUM(CASE WHEN status != 'matched' THEN 1 ELSE 0 END) as discrepancies,
        ROUND(SUM(COALESCE(variance_amount, -expected_amount)), 2) as total_variance,
        ROUND(
          SUM(CASE WHEN status = 'matched' THEN 1 ELSE 0 END) * 100.0 / COUNT(*),
          2
        ) as accuracy_rate
      FROM reconciliations
      ${whereClause}
      GROUP BY reconciliation_date
      ORDER BY reconciliation_date ASC
    `;

    const data = db.prepare(query).all(...params);

    res.json({ data });
  } catch (err) {
    next(err);
  }
});

export default router;
