import { Router } from 'express';
import { db } from '../db/index.js';

const router = Router();

/**
 * @swagger
 * /api/orders:
 *   get:
 *     summary: List orders with filters
 *     tags: [Orders]
 *     parameters:
 *       - in: query
 *         name: store_id
 *         schema: { type: string }
 *         example: "CDMX-001"
 *       - in: query
 *         name: date
 *         schema: { type: string }
 *         description: Filter by pickup_date (YYYY-MM-DD)
 *         example: "2024-01-15"
 *       - in: query
 *         name: region
 *         schema: { type: string }
 *         example: "cdmx"
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [matched, over_collection, under_collection, unaccounted] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200:
 *         description: Paginated list of orders with reconciliation status
 */
router.get('/', (req, res, next) => {
  try {
    const { store_id, date, region, status, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT o.*, r.status as reconciliation_status, r.actual_amount,
             r.variance_amount, r.variance_pct, r.is_high_priority, r.reconciled_at
      FROM orders o
      LEFT JOIN reconciliations r ON o.order_id = r.order_id
      WHERE 1=1
    `;
    const params = [];

    if (store_id) { query += ` AND o.store_id = ?`; params.push(store_id); }
    if (date) { query += ` AND o.pickup_date = ?`; params.push(date); }
    if (region) { query += ` AND o.region = ?`; params.push(region); }
    if (status) { query += ` AND r.status = ?`; params.push(status); }

    query += ` ORDER BY o.pickup_date DESC, o.store_id LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const rows = db.prepare(query).all(...params);
    res.json({ success: true, page: parseInt(page), limit: parseInt(limit), count: rows.length, orders: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/orders/{order_id}:
 *   get:
 *     summary: Get order detail with reconciliation status
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: order_id
 *         required: true
 *         schema: { type: string }
 *         example: "ORD-0001"
 *     responses:
 *       200:
 *         description: Order detail with reconciliation info
 *       404:
 *         description: Order not found
 */
router.get('/:order_id', (req, res, next) => {
  try {
    const { order_id } = req.params;

    const order = db.prepare(`
      SELECT o.*, r.status as reconciliation_status, r.actual_amount, r.variance_amount,
             r.variance_pct, r.is_high_priority, r.reconciled_at, r.report_id
      FROM orders o
      LEFT JOIN reconciliations r ON o.order_id = r.order_id
      WHERE o.order_id = ?
    `).get(order_id);

    if (!order) {
      return res.status(404).json({ success: false, error: `Order "${order_id}" not found` });
    }

    res.json({ success: true, order });
  } catch (err) {
    next(err);
  }
});

export default router;
