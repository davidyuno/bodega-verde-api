import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { upload } from '../middleware/upload.js';
import { parseOrdersCsv, parseCashReportsCsv } from '../services/csvParser.js';
import { db } from '../db/index.js';

const router = Router();

/**
 * @swagger
 * /api/ingest/orders:
 *   post:
 *     summary: Upload orders CSV file
 *     tags: [Ingestion]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: CSV file (only .csv accepted)
 *     responses:
 *       200:
 *         description: Orders ingested successfully
 *       400:
 *         description: Invalid file type or missing columns
 */
router.post('/orders', upload.single('file'), (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded. Send a .csv file in the "file" field.' });
    }

    const rows = parseOrdersCsv(req.file.buffer);
    const now = new Date().toISOString();
    let inserted = 0;
    let skipped = 0;

    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO orders
        (id, order_id, store_id, region, customer_id, customer_name, order_date, pickup_date,
         expected_amount, currency, timezone, payment_method, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((orders) => {
      for (const o of orders) {
        const result = insertStmt.run(
          uuidv4(), o.order_id, o.store_id, o.region, o.customer_id, o.customer_name,
          o.order_date, o.pickup_date, o.expected_amount, o.currency,
          'America/Mexico_City', o.payment_method, now
        );
        result.changes > 0 ? inserted++ : skipped++;
      }
    });

    insertMany(rows);

    res.json({
      success: true,
      message: `Ingested ${inserted} orders (${skipped} duplicates skipped)`,
      inserted,
      skipped,
      total: rows.length,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/ingest/cash-reports:
 *   post:
 *     summary: Upload cash collection reports CSV file
 *     tags: [Ingestion]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: CSV file (only .csv accepted)
 *     responses:
 *       200:
 *         description: Cash reports ingested successfully
 *       400:
 *         description: Invalid file type or missing columns
 */
router.post('/cash-reports', upload.single('file'), (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded. Send a .csv file in the "file" field.' });
    }

    const rows = parseCashReportsCsv(req.file.buffer);
    const now = new Date().toISOString();
    let inserted = 0;
    let skipped = 0;

    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO cash_reports
        (id, report_id, store_id, report_date, total_collected, order_ids, submitted_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((reports) => {
      for (const r of reports) {
        const result = insertStmt.run(
          uuidv4(), r.report_id, r.store_id, r.report_date,
          r.total_collected, JSON.stringify(r.order_ids), r.submitted_by, now
        );
        result.changes > 0 ? inserted++ : skipped++;
      }
    });

    insertMany(rows);

    res.json({
      success: true,
      message: `Ingested ${inserted} cash reports (${skipped} duplicates skipped)`,
      inserted,
      skipped,
      total: rows.length,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
