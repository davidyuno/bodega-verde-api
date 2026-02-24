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
 *         schema:
 *           type: string
 *         description: Filter by store ID
 *         example: "CDMX-001"
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *         description: Filter by pickup_date (YYYY-MM-DD)
 *         example: "2024-01-15"
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [matched, over_collection, under_collection, unaccounted]
 *         description: Filter by reconciliation status (requires JOIN with reconciliations)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Results per page (max 100)
 *     responses:
 *       200:
 *         description: Paginated list of orders
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 */
router.get('/', (req, res, next) => {
  try {
    const { store_id, date, status } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    let dataQuery;
    let countQuery;
    const params = [];
    const countParams = [];

    if (status) {
      // JOIN with reconciliations to filter by reconciliation status
      dataQuery = `
        SELECT orders.*
        FROM orders
        LEFT JOIN reconciliations ON orders.order_id = reconciliations.order_id
        WHERE reconciliations.status = ?
      `;
      countQuery = `
        SELECT COUNT(*) as total
        FROM orders
        LEFT JOIN reconciliations ON orders.order_id = reconciliations.order_id
        WHERE reconciliations.status = ?
      `;
      params.push(status);
      countParams.push(status);

      if (store_id) {
        dataQuery += ` AND orders.store_id = ?`;
        countQuery += ` AND orders.store_id = ?`;
        params.push(store_id);
        countParams.push(store_id);
      }
      if (date) {
        dataQuery += ` AND orders.pickup_date = ?`;
        countQuery += ` AND orders.pickup_date = ?`;
        params.push(date);
        countParams.push(date);
      }

      dataQuery += ` ORDER BY orders.pickup_date DESC, orders.order_id LIMIT ? OFFSET ?`;
      params.push(limit, offset);
    } else {
      dataQuery = `SELECT * FROM orders WHERE 1=1`;
      countQuery = `SELECT COUNT(*) as total FROM orders WHERE 1=1`;

      if (store_id) {
        dataQuery += ` AND store_id = ?`;
        countQuery += ` AND store_id = ?`;
        params.push(store_id);
        countParams.push(store_id);
      }
      if (date) {
        dataQuery += ` AND pickup_date = ?`;
        countQuery += ` AND pickup_date = ?`;
        params.push(date);
        countParams.push(date);
      }

      dataQuery += ` ORDER BY pickup_date DESC, order_id LIMIT ? OFFSET ?`;
      params.push(limit, offset);
    }

    const data = db.prepare(dataQuery).all(...params);
    const { total } = db.prepare(countQuery).get(...countParams);

    res.json({
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
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
 *         schema:
 *           type: string
 *         description: Business order ID
 *         example: "ORD-0001"
 *     responses:
 *       200:
 *         description: Order detail with reconciliation info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 order:
 *                   type: object
 *                 reconciliation:
 *                   type: object
 *                   nullable: true
 *       404:
 *         description: Order not found
 */
router.get('/:order_id', (req, res, next) => {
  try {
    const { order_id } = req.params;

    const order = db.prepare(`SELECT * FROM orders WHERE order_id = ?`).get(order_id);

    if (!order) {
      return res.status(404).json({ success: false, error: `Order "${order_id}" not found` });
    }

    const reconciliation = db.prepare(
      `SELECT * FROM reconciliations WHERE order_id = ?`
    ).get(order_id) || null;

    res.json({ order, reconciliation });
  } catch (err) {
    next(err);
  }
});

export default router;
