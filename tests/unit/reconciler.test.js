// MUST be set before any imports so db/index.js picks up :memory: SQLite
process.env.NODE_ENV = 'test';

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../src/db/index.js';
import { runMigrations } from '../../src/db/migrate.js';
import { reconcileDate } from '../../src/services/reconciler.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function insertOrder(o) {
  db.prepare(`
    INSERT OR IGNORE INTO orders
      (id, order_id, store_id, region, customer_id, customer_name,
       order_date, pickup_date, expected_amount, currency, timezone,
       payment_method, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    uuidv4(),
    o.order_id,
    o.store_id,
    o.region      ?? 'cdmx',
    o.customer_id ?? 'CUST-001',
    o.customer_name ?? 'Test User',
    o.order_date,
    o.pickup_date,
    o.expected_amount,
    o.currency      ?? 'MXN',
    'America/Mexico_City',
    o.payment_method ?? 'cash_on_pickup',
    new Date().toISOString(),
  );
}

function insertReport(r) {
  db.prepare(`
    INSERT OR IGNORE INTO cash_reports
      (id, report_id, store_id, report_date, total_collected, order_ids,
       submitted_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    uuidv4(),
    r.report_id,
    r.store_id,
    r.report_date,
    r.total_collected,
    JSON.stringify(r.order_ids),
    r.submitted_by ?? 'Manager',
    new Date().toISOString(),
  );
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeAll(() => {
  runMigrations();
});

beforeEach(() => {
  db.exec('DELETE FROM reconciliations; DELETE FROM cash_reports; DELETE FROM orders;');
});

// ---------------------------------------------------------------------------
// 1. Perfect match
// ---------------------------------------------------------------------------

describe('reconcileDate — perfect match', () => {
  it('sets status=matched and variance_amount=0 when collected equals expected', () => {
    insertOrder({
      order_id: 'O1', store_id: 'STORE-001',
      order_date: '2024-01-15', pickup_date: '2024-01-15',
      expected_amount: 500.00,
    });
    insertReport({
      report_id: 'R1', store_id: 'STORE-001', report_date: '2024-01-15',
      total_collected: 500.00, order_ids: ['O1'],
    });

    const result = reconcileDate('2024-01-15', 'STORE-001');

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('matched');
    expect(result[0].variance_amount).toBe(0);
    expect(result[0].is_high_priority).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Under-collection
// ---------------------------------------------------------------------------

describe('reconcileDate — under-collection', () => {
  it('sets status=under_collection and variance_amount<0 when collected < expected', () => {
    insertOrder({
      order_id: 'O1', store_id: 'STORE-001',
      order_date: '2024-01-15', pickup_date: '2024-01-15',
      expected_amount: 500.00,
    });
    // Report references O1 but only collected 400 — short by 100
    insertReport({
      report_id: 'R1', store_id: 'STORE-001', report_date: '2024-01-15',
      total_collected: 400.00, order_ids: ['O1'],
    });

    const result = reconcileDate('2024-01-15', 'STORE-001');

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('under_collection');
    expect(result[0].variance_amount).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Over-collection
// ---------------------------------------------------------------------------

describe('reconcileDate — over-collection', () => {
  it('sets status=over_collection and variance_amount>0 when collected > expected', () => {
    insertOrder({
      order_id: 'O1', store_id: 'STORE-001',
      order_date: '2024-01-15', pickup_date: '2024-01-15',
      expected_amount: 500.00,
    });
    // Report collected 650 — 150 excess
    insertReport({
      report_id: 'R1', store_id: 'STORE-001', report_date: '2024-01-15',
      total_collected: 650.00, order_ids: ['O1'],
    });

    const result = reconcileDate('2024-01-15', 'STORE-001');

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('over_collection');
    expect(result[0].variance_amount).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Unaccounted order
// ---------------------------------------------------------------------------

describe('reconcileDate — unaccounted', () => {
  it('sets status=unaccounted and actual_amount=null when no report claims the order', () => {
    insertOrder({
      order_id: 'O1', store_id: 'STORE-001',
      order_date: '2024-01-15', pickup_date: '2024-01-15',
      expected_amount: 500.00,
    });
    // Deliberately insert no cash report

    const result = reconcileDate('2024-01-15', 'STORE-001');

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('unaccounted');
    expect(result[0].actual_amount).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5. High-priority — absolute variance > $100
// ---------------------------------------------------------------------------

describe('reconcileDate — high priority (variance > $100)', () => {
  it('sets is_high_priority=1 when absolute variance exceeds $100', () => {
    insertOrder({
      order_id: 'O1', store_id: 'STORE-001',
      order_date: '2024-01-15', pickup_date: '2024-01-15',
      expected_amount: 500.00,
    });
    // Collected 700 → variance = +200 > 100
    insertReport({
      report_id: 'R1', store_id: 'STORE-001', report_date: '2024-01-15',
      total_collected: 700.00, order_ids: ['O1'],
    });

    const result = reconcileDate('2024-01-15', 'STORE-001');

    expect(result[0].is_high_priority).toBe(1);
    expect(Math.abs(result[0].variance_amount)).toBeGreaterThan(100);
  });
});

// ---------------------------------------------------------------------------
// 6. High-priority — variance percentage > 10 %
// ---------------------------------------------------------------------------

describe('reconcileDate — high priority (variance > 10%)', () => {
  it('sets is_high_priority=1 when percentage variance exceeds 10%', () => {
    insertOrder({
      order_id: 'O1', store_id: 'STORE-001',
      order_date: '2024-01-15', pickup_date: '2024-01-15',
      expected_amount: 500.00,
    });
    // Collected 560 → variance = +60 → 60/500 = 12% > 10%
    insertReport({
      report_id: 'R1', store_id: 'STORE-001', report_date: '2024-01-15',
      total_collected: 560.00, order_ids: ['O1'],
    });

    const result = reconcileDate('2024-01-15', 'STORE-001');

    expect(result[0].is_high_priority).toBe(1);
    expect(Math.abs(result[0].variance_pct)).toBeGreaterThan(10);
  });
});

// ---------------------------------------------------------------------------
// 7. NOT high-priority — small variance
// ---------------------------------------------------------------------------

describe('reconcileDate — not high priority (small variance)', () => {
  it('sets is_high_priority=0 when variance is well within thresholds', () => {
    insertOrder({
      order_id: 'O1', store_id: 'STORE-001',
      order_date: '2024-01-15', pickup_date: '2024-01-15',
      expected_amount: 500.00,
    });
    // Collected 505 → variance = +5 → 5/500 = 1% — both thresholds pass
    insertReport({
      report_id: 'R1', store_id: 'STORE-001', report_date: '2024-01-15',
      total_collected: 505.00, order_ids: ['O1'],
    });

    const result = reconcileDate('2024-01-15', 'STORE-001');

    expect(result[0].is_high_priority).toBe(0);
  });
});
