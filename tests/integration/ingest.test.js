import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

import { createApp } from '../../src/app.js';
import { db } from '../../src/db/index.js';

const app = createApp();

beforeEach(() => {
  db.exec('DELETE FROM reconciliations; DELETE FROM orders; DELETE FROM cash_reports;');
});

const SEED_DIR = join(__dirname, '../../data/seed');

describe('POST /api/ingest/orders', () => {
  it('ingests valid orders CSV successfully', async () => {
    const res = await request(app)
      .post('/api/ingest/orders')
      .attach('file', join(SEED_DIR, 'orders.csv'));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.inserted).toBeGreaterThan(100);
  });

  it('skips duplicate orders on re-upload', async () => {
    await request(app).post('/api/ingest/orders').attach('file', join(SEED_DIR, 'orders.csv'));
    const res = await request(app).post('/api/ingest/orders').attach('file', join(SEED_DIR, 'orders.csv'));

    expect(res.status).toBe(200);
    expect(res.body.skipped).toBeGreaterThan(0);
    expect(res.body.inserted).toBe(0);
  });

  it('rejects a JSON file with 400', async () => {
    const res = await request(app)
      .post('/api/ingest/orders')
      .attach('file', Buffer.from('{"key":"value"}'), { filename: 'data.json', contentType: 'application/json' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/\.csv/i);
  });

  it('returns 400 when no file is provided', async () => {
    const res = await request(app).post('/api/ingest/orders');
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 for CSV missing required columns', async () => {
    const bad = Buffer.from('order_id,store_id\nORD-001,CDMX-001');
    const res = await request(app)
      .post('/api/ingest/orders')
      .attach('file', bad, { filename: 'orders.csv', contentType: 'text/csv' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Missing required columns/i);
  });
});

describe('POST /api/ingest/cash-reports', () => {
  it('ingests valid cash reports CSV successfully', async () => {
    const res = await request(app)
      .post('/api/ingest/cash-reports')
      .attach('file', join(SEED_DIR, 'cash_reports.csv'));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.inserted).toBeGreaterThan(0);
  });

  it('rejects a non-csv file with 400', async () => {
    const res = await request(app)
      .post('/api/ingest/cash-reports')
      .attach('file', Buffer.from('<xml/>'), { filename: 'report.xml', contentType: 'application/xml' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when no file is provided', async () => {
    const res = await request(app).post('/api/ingest/cash-reports');
    expect(res.status).toBe(400);
  });
});
