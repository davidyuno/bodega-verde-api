import { db } from './index.js';

export function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL UNIQUE,
      store_id TEXT NOT NULL,
      region TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      order_date TEXT NOT NULL,
      pickup_date TEXT NOT NULL,
      expected_amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'MXN',
      timezone TEXT NOT NULL DEFAULT 'America/Mexico_City',
      payment_method TEXT NOT NULL DEFAULT 'cash_on_pickup',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cash_reports (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL UNIQUE,
      store_id TEXT NOT NULL,
      report_date TEXT NOT NULL,
      total_collected REAL NOT NULL,
      order_ids TEXT NOT NULL,
      submitted_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reconciliations (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      report_id TEXT,
      store_id TEXT NOT NULL,
      reconciliation_date TEXT NOT NULL,
      expected_amount REAL NOT NULL,
      actual_amount REAL,
      variance_amount REAL,
      variance_pct REAL,
      status TEXT NOT NULL,
      is_high_priority INTEGER NOT NULL DEFAULT 0,
      reconciled_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_orders_store_date ON orders(store_id, pickup_date);
    CREATE INDEX IF NOT EXISTS idx_orders_order_id ON orders(order_id);
    CREATE INDEX IF NOT EXISTS idx_cash_reports_store_date ON cash_reports(store_id, report_date);
    CREATE INDEX IF NOT EXISTS idx_reconciliations_date ON reconciliations(reconciliation_date);
    CREATE INDEX IF NOT EXISTS idx_reconciliations_store ON reconciliations(store_id);
    CREATE INDEX IF NOT EXISTS idx_reconciliations_status ON reconciliations(status);
  `);
}
