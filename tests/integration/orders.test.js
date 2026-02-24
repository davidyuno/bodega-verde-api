import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_DIR = join(__dirname, '../../data/seed');

import { createApp } from '../../src/app.js';
import { db } from '../../src/db/index.js';

const app = createApp();

beforeAll(async () => {
  db.exec('DELETE FROM reconciliations; DELETE FROM orders; DELETE FROM cash_reports;');
  await request(app).post('/api/ingest/orders').attach('file', join(SEED_DIR, 'orders.csv'));
  await request(app).post('/api/ingest/cash-reports').attach('file', join(SEED_DIR, 'cash_reports.csv'));
  await request(app).post('/api/reconcile').send({});
});

describe('GET /api/orders', () => {
  it('returns all orders with default pagination', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.pagination).toBeDefined();
  });

  it('filters by store_id and date', async () => {
    const res = await request(app).get('/api/orders?store_id=CDMX-001&date=2024-01-15');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    res.body.data.forEach(o => {
      expect(o.store_id).toBe('CDMX-001');
      expect(o.pickup_date).toBe('2024-01-15');
    });
  });

  it('respects pagination limit', async () => {
    const res = await request(app).get('/api/orders?limit=5&page=1');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(5);
    expect(res.body.pagination.limit).toBe(5);
  });
});

describe('GET /api/orders/:order_id', () => {
  it('returns order detail with reconciliation status', async () => {
    const res = await request(app).get('/api/orders/ORD-0001');
    expect(res.status).toBe(200);
    expect(res.body.order.order_id).toBe('ORD-0001');
    expect(res.body).toHaveProperty('reconciliation');
  });

  it('returns 404 for unknown order_id', async () => {
    const res = await request(app).get('/api/orders/NONEXISTENT-9999');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

describe('GET /api/analytics/stores', () => {
  it('returns per-store statistics', async () => {
    const res = await request(app).get('/api/analytics/stores');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    res.body.data.forEach(s => {
      expect(s).toHaveProperty('store_id');
      expect(s).toHaveProperty('discrepancy_rate');
      expect(s).toHaveProperty('total_variance');
    });
  });

  it('CDMX-001 should have zero discrepancy rate', async () => {
    const res = await request(app).get('/api/analytics/stores');
    const cdmx001 = res.body.data.find(s => s.store_id === 'CDMX-001');
    expect(cdmx001).toBeDefined();
    expect(cdmx001.discrepancy_rate).toBe(0);
  });
});

describe('GET /api/analytics/daily', () => {
  it('returns daily accuracy breakdown', async () => {
    const res = await request(app).get('/api/analytics/daily?from=2024-01-15&to=2024-01-19');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(5);
    res.body.data.forEach(d => {
      expect(d).toHaveProperty('date');
      expect(d).toHaveProperty('accuracy_rate');
    });
  });
});

describe('GET /api/health', () => {
  it('returns healthy status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
