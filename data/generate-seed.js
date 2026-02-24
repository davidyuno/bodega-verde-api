/**
 * Seed data generator for Bodega Verde Cash Reconciliation Engine
 *
 * Generates:
 * - 100+ orders across 5 stores, 5 days
 * - Cash reports with intentional discrepancy scenarios
 *
 * Stores:
 *   CDMX-001 (cdmx) — Consistently accurate (all matched)
 *   CDMX-002 (cdmx) — Frequent under-collection (missing orders)
 *   GDL-001  (gdl)  — Occasional over-collection (duplicate amounts)
 *   GDL-002  (gdl)  — Mixed matched and discrepancies
 *   MTY-001  (mty)  — 2-3 unaccounted orders (no cash report mentions them)
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const STORES = [
  { store_id: 'CDMX-001', region: 'cdmx', behavior: 'accurate' },
  { store_id: 'CDMX-002', region: 'cdmx', behavior: 'under' },
  { store_id: 'GDL-001',  region: 'gdl',  behavior: 'over' },
  { store_id: 'GDL-002',  region: 'gdl',  behavior: 'mixed' },
  { store_id: 'MTY-001',  region: 'mty',  behavior: 'unaccounted' },
];

const DATES = [
  '2024-01-15',
  '2024-01-16',
  '2024-01-17',
  '2024-01-18',
  '2024-01-19',
];

const CUSTOMER_NAMES = [
  'Juan García', 'María López', 'Carlos Martínez', 'Ana Rodríguez', 'Luis Hernández',
  'Sofía Torres', 'Miguel Ramírez', 'Isabella Flores', 'José Morales', 'Valentina Cruz',
  'Diego Reyes', 'Camila Jiménez', 'Andrés Ruiz', 'Lucía Álvarez', 'Sebastián Díaz',
  'Gabriela Vásquez', 'Mateo Romero', 'Fernanda Medina', 'Javier Castro', 'Daniela Vargas',
];

const AMOUNTS = [150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 750, 800, 1000, 1200, 1500];

let orderCounter = 1;
let reportCounter = 1;

function padId(n, prefix) {
  return `${prefix}-${String(n).padStart(4, '0')}`;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateOrders() {
  const orders = [];
  // 4-5 orders per store per day → ~100+ total (5 stores × 5 days × 4-5 = 100-125)
  for (const store of STORES) {
    for (const date of DATES) {
      const count = 4 + Math.floor(Math.random() * 2); // 4 or 5
      for (let i = 0; i < count; i++) {
        orders.push({
          order_id: padId(orderCounter++, 'ORD'),
          store_id: store.store_id,
          region: store.region,
          customer_id: padId(orderCounter, 'CUST'),
          customer_name: pickRandom(CUSTOMER_NAMES),
          order_date: date,
          pickup_date: date,
          expected_amount: pickRandom(AMOUNTS),
          currency: 'MXN',
          payment_method: 'cash_on_pickup',
        });
      }
    }
  }
  return orders;
}

function generateReports(orders) {
  const reports = [];

  // Group orders by store + date
  const grouped = {};
  for (const o of orders) {
    const key = `${o.store_id}::${o.pickup_date}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(o);
  }

  // Track which orders will be "unaccounted" (MTY-001, first 2 orders overall)
  const unaccountedOrders = new Set();
  const mtyOrders = orders.filter(o => o.store_id === 'MTY-001');
  // Mark 3 specific MTY-001 orders across different days as unaccounted
  unaccountedOrders.add(mtyOrders[0].order_id);
  unaccountedOrders.add(mtyOrders[5].order_id);
  unaccountedOrders.add(mtyOrders[10].order_id);

  for (const [key, storeOrders] of Object.entries(grouped)) {
    const [storeId, date] = key.split('::');
    const store = STORES.find(s => s.store_id === storeId);
    const reportId = padId(reportCounter++, 'RPT');
    const submittedBy = `Manager-${storeId}`;

    // Filter out unaccounted orders from the report
    const reportableOrders = storeOrders.filter(o => !unaccountedOrders.has(o.order_id));

    if (reportableOrders.length === 0) {
      // All orders unaccounted — skip the report entirely
      continue;
    }

    const expectedTotal = reportableOrders.reduce((s, o) => s + o.expected_amount, 0);
    let totalCollected;

    switch (store.behavior) {
      case 'accurate':
        totalCollected = expectedTotal;
        break;

      case 'under':
        // Under-collect: randomly drop 1 order from the total (but still claim all order IDs)
        // This creates a scenario where total_collected < sum of claimed orders
        totalCollected = expectedTotal - reportableOrders[0].expected_amount;
        break;

      case 'over':
        // Over-collect: report more than expected (duplicate entry or error)
        totalCollected = expectedTotal + pickRandom([100, 150, 200, 250]);
        break;

      case 'mixed':
        // Alternate: accurate for first 3 days, under for last 2
        totalCollected = (DATES.indexOf(date) < 3)
          ? expectedTotal
          : expectedTotal - (reportableOrders[0]?.expected_amount || 0);
        break;

      case 'unaccounted':
        // MTY-001: reports are accurate for the orders they DO mention
        totalCollected = expectedTotal;
        break;
    }

    reports.push({
      report_id: reportId,
      store_id: storeId,
      report_date: date,
      total_collected: Math.max(0, totalCollected),
      order_ids: reportableOrders.map(o => o.order_id).join(','),
      submitted_by: submittedBy,
    });
  }

  return reports;
}

function toCsv(rows, columns) {
  const header = columns.join(',');
  const lines = rows.map(row =>
    columns.map(col => {
      const val = String(row[col] ?? '');
      return val.includes(',') ? `"${val}"` : val;
    }).join(',')
  );
  return [header, ...lines].join('\n');
}

// Generate
const orders = generateOrders();
const reports = generateReports(orders);

const ordersCsv = toCsv(orders, [
  'order_id', 'store_id', 'region', 'customer_id', 'customer_name',
  'order_date', 'pickup_date', 'expected_amount', 'currency', 'payment_method',
]);

const reportsCsv = toCsv(reports, [
  'report_id', 'store_id', 'report_date', 'total_collected', 'order_ids', 'submitted_by',
]);

writeFileSync(join(__dirname, 'seed', 'orders.csv'), ordersCsv);
writeFileSync(join(__dirname, 'seed', 'cash_reports.csv'), reportsCsv);

console.log(`Generated ${orders.length} orders → data/seed/orders.csv`);
console.log(`Generated ${reports.length} cash reports → data/seed/cash_reports.csv`);
console.log('\nStore scenarios:');
console.log('  CDMX-001 — Accurate (all matched)');
console.log('  CDMX-002 — Under-collection (reports less than expected)');
console.log('  GDL-001  — Over-collection (reports more than expected)');
console.log('  GDL-002  — Mixed (accurate Mon-Wed, under Thu-Fri)');
console.log('  MTY-001  — Has 3 unaccounted orders (no cash report mentions them)');
