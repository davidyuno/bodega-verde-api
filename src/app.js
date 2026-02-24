import express from 'express';
import { swaggerUi, swaggerSpec } from './swagger.js';
import { runMigrations } from './db/migrate.js';
import ingestRouter from './routes/ingest.js';
import reconciliationRouter from './routes/reconciliation.js';
import ordersRouter from './routes/orders.js';
import analyticsRouter from './routes/analytics.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  runMigrations();

  const app = express();
  app.use(express.json());

  // Ingestion, Orders, Analytics
  app.use('/api/ingest', ingestRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/analytics', analyticsRouter);

  // Reconciliation router owns /api/reconcile[/batch] and /api/reconciliation/*
  // Mount at /api so the router's internal paths (/reconcile, /reconcile/batch,
  // /reconciliation/summary, etc.) resolve to the correct full paths.
  app.use('/api', reconciliationRouter);

  /**
   * @swagger
   * /api/health:
   *   get:
   *     summary: Health check
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Service is healthy
   */
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Swagger UI
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // 404
  app.use((req, res) => {
    res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` });
  });

  app.use(errorHandler);

  return app;
}

export default createApp();
