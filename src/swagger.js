import swaggerJsdoc from 'swagger-jsdoc';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Bodega Verde Cash Reconciliation API',
      version: '1.0.0',
      description: 'API for automating cash payment reconciliation for Bodega Verde retail stores.',
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
  // Use absolute path so the glob works in any working directory (including Vercel)
  apis: [join(__dirname, 'routes', '*.js')],
};

export const swaggerSpec = swaggerJsdoc(options);
