import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Bodega Verde Cash Reconciliation API',
      version: '1.0.0',
      description: `
## Cash Reconciliation Engine

Automates Bodega Verde's cash payment reconciliation workflow.

**Quick start:**
1. Upload \`data/seed/orders.csv\` via \`POST /api/ingest/orders\`
2. Upload \`data/seed/cash_reports.csv\` via \`POST /api/ingest/cash-reports\`
3. Run \`POST /api/reconcile\` to generate reconciliation results
4. Query \`GET /api/reconciliation/summary\` or \`GET /api/reconciliation/discrepancies\`

> **CSV uploads only accept \`.csv\` files.** Any other format returns a 400 error.
      `,
    },
    servers: [
      { url: '/api', description: 'Current server' },
    ],
    tags: [
      { name: 'Health', description: 'Service health' },
      { name: 'Ingestion', description: 'Upload CSV data files' },
      { name: 'Reconciliation', description: 'Run and query reconciliation results' },
      { name: 'Orders', description: 'Query order data' },
      { name: 'Analytics', description: 'Trend analysis and statistics' },
    ],
  },
  apis: ['./src/routes/*.js'],
};

export const swaggerSpec = swaggerJsdoc(options);
