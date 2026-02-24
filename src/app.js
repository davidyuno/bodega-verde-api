import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger.js';
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

  // Swagger UI
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Bodega Verde API',
  }));
  app.get('/api/docs.json', (req, res) => res.json(swaggerSpec));

  // Health
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

  // Routes
  app.use('/api/ingest', ingestRouter);
  app.use('/api/reconcile', reconciliationRouter);
  app.use('/api/reconciliation', reconciliationRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/analytics', analyticsRouter);

  // 404
  app.use((req, res) => {
    res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` });
  });

  app.use(errorHandler);

  return app;
}
