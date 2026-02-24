import express from 'express';
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

  // Swagger UI — CDN-based, works in Vercel serverless (no static file serving needed)
  app.get('/api/docs.json', (req, res) => res.json(swaggerSpec));
  app.get('/api/docs', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Bodega Verde API — Swagger UI</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      SwaggerUIBundle({
        url: '/api/docs.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
        layout: 'BaseLayout',
      });
    };
  </script>
</body>
</html>`);
  });

  // 404
  app.use((req, res) => {
    res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` });
  });

  app.use(errorHandler);

  return app;
}

export default createApp();
