import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

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
  apis: ['./src/routes/*.js'],
};

export const swaggerSpec = swaggerJsdoc(options);
export { swaggerUi };
