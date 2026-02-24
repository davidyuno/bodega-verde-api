import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';

export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(),
  order_id: text('order_id').notNull().unique(),
  store_id: text('store_id').notNull(),
  region: text('region').notNull(),
  customer_id: text('customer_id').notNull(),
  customer_name: text('customer_name').notNull(),
  order_date: text('order_date').notNull(),
  pickup_date: text('pickup_date').notNull(),
  expected_amount: real('expected_amount').notNull(),
  currency: text('currency').notNull().default('MXN'),
  timezone: text('timezone').notNull().default('America/Mexico_City'),
  payment_method: text('payment_method').notNull().default('cash_on_pickup'),
  created_at: text('created_at').notNull(),
});

export const cashReports = sqliteTable('cash_reports', {
  id: text('id').primaryKey(),
  report_id: text('report_id').notNull().unique(),
  store_id: text('store_id').notNull(),
  report_date: text('report_date').notNull(),
  total_collected: real('total_collected').notNull(),
  order_ids: text('order_ids').notNull(), // JSON array string
  submitted_by: text('submitted_by').notNull(),
  created_at: text('created_at').notNull(),
});

export const reconciliations = sqliteTable('reconciliations', {
  id: text('id').primaryKey(),
  order_id: text('order_id').notNull(),
  report_id: text('report_id'),
  store_id: text('store_id').notNull(),
  reconciliation_date: text('reconciliation_date').notNull(),
  expected_amount: real('expected_amount').notNull(),
  actual_amount: real('actual_amount'),
  variance_amount: real('variance_amount'),
  variance_pct: real('variance_pct'),
  status: text('status').notNull(), // matched | over_collection | under_collection | unaccounted
  is_high_priority: integer('is_high_priority').notNull().default(0),
  reconciled_at: text('reconciled_at').notNull(),
});
