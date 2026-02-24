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

describe('POST /api/reconcile', () => {
  it('reconciles all data and returns record count', async () => {
    const res = await request(app).post('/api/reconcile').send({});
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.reconciled).toBeGreaterThan(100);
    expect(Array.isArray(res.body.records)).toBe(true);
  });

  it('reconciles a specific date', async () => {
    const res = await request(app).post('/api/reconcile').send({ date: '2024-01-15' });
    expect(res.status).toBe(200);
    expect(res.body.reconciled).toBeGreaterThan(0);
  });

  it('reconciles a specific store on a specific date', async () => {
    const res = await request(app).post('/api/reconcile').send({ date: '2024-01-15', store_id: 'CDMX-001' });
    expect(res.status).toBe(200);
    expect(res.body.reconciled).toBeGreaterThan(0);
    res.body.records.forEach(r => expect(r.store_id).toBe('CDMX-001'));
  });
});

describe('POST /api/reconcile/batch', () => {
  it('reconciles a date range', async () => {
    const res = await request(app).post('/api/reconcile/batch').send({ from: '2024-01-15', to: '2024-01-17' });
    expect(res.status).toBe(200);
    expect(res.body.reconciled).toBeGreaterThan(0);
    expect(Array.isArray(res.body.records)).toBe(true);
  });

  it('returns 400 when from/to are missing', async () => {
    const res = await request(app).post('/api/reconcile/batch').send({ from: '2024-01-15' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/reconciliation/summary', () => {
  it('returns summary for a date range', async () => {
    const res = await request(app).get('/api/reconciliation/summary?from=2024-01-15&to=2024-01-19');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('total_orders');
  });

  it('filters by store_id', async () => {
    const res = await request(app).get('/api/reconciliation/summary?store_id=CDMX-001');
    expect(res.status).toBe(200);
    res.body.data.forEach(row => expect(row.store_id).toBe('CDMX-001'));
  });
});

describe('GET /api/reconciliation/discrepancies', () => {
  it('returns all discrepancies', async () => {
    const res = await request(app).get('/api/reconciliation/discrepancies');
    expect(res.status).toBe(200);
    expect(res.body.count).toBeGreaterThan(0);
    res.body.data.forEach(d => expect(d.status).not.toBe('matched'));
  });

  it('filters by min_variance', async () => {
    const res = await request(app).get('/api/reconciliation/discrepancies?min_variance=100');
    expect(res.status).toBe(200);
    res.body.data.forEach(d => {
      expect(Math.abs(d.variance_amount)).toBeGreaterThanOrEqual(100);
    });
  });

  it('filters high priority only', async () => {
    const res = await request(app).get('/api/reconciliation/discrepancies?priority=true');
    expect(res.status).toBe(200);
    res.body.data.forEach(d => expect(d.is_high_priority).toBe(1));
  });
});

describe('GET /api/reconciliation/status', () => {
  it('returns reconciliation records', async () => {
    const res = await request(app).get('/api/reconciliation/status');
    expect(res.status).toBe(200);
    expect(res.body.count).toBeGreaterThan(0);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('filters by status=unaccounted and finds MTY-001 orders', async () => {
    const res = await request(app).get('/api/reconciliation/status?status=unaccounted');
    expect(res.status).toBe(200);
    res.body.data.forEach(r => expect(r.status).toBe('unaccounted'));
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
  });

  it('filters by store and date', async () => {
    const res = await request(app).get('/api/reconciliation/status?store_id=CDMX-001&date=2024-01-15');
    expect(res.status).toBe(200);
    res.body.data.forEach(r => {
      expect(r.store_id).toBe('CDMX-001');
      expect(r.reconciliation_date).toBe('2024-01-15');
    });
  });
});
