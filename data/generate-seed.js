/**
 * Seed data generator for Bodega Verde Cash Reconciliation Engine
 *
 * Generates:
 *   data/seed/orders.csv      — 125 orders (5 stores × 5 days × 5 orders)
 *   data/seed/cash_reports.csv — 23 reports (MTY-001 days 1 & 3 have no report)
 *
 * Store scenarios:
 *   CDMX-001 (cdmx) — All 5 days: matched (exact sums)
 *   CDMX-002 (cdmx) — Days 1-4: under-collection (1 order omitted from report);
 *                      Day 5: matched
 *   GDL-001  (gdl)  — Days 1, 3: over-collection (+200 MXN each);
 *                      Days 2, 4, 5: matched
 *   GDL-002  (gdl)  — Day 1: matched; Day 2: under-collection (1 order omitted);
 *                      Day 3: matched; Day 4: over-collection (+150 MXN); Day 5: matched
 *   MTY-001  (mty)  — Days 1, 3: NO cash report (orders are unaccounted);
 *                      Days 2, 4, 5: matched
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Reference tables
// ---------------------------------------------------------------------------

const DATES = [
  '2024-01-15',
  '2024-01-16',
  '2024-01-17',
  '2024-01-18',
  '2024-01-19',
];

const STORES = [
  { store_id: 'CDMX-001', region: 'cdmx', manager: 'María López' },
  { store_id: 'CDMX-002', region: 'cdmx', manager: 'Roberto Sánchez' },
  { store_id: 'GDL-001',  region: 'gdl',  manager: 'Elena Gutiérrez' },
  { store_id: 'GDL-002',  region: 'gdl',  manager: 'Fernando Jiménez' },
  { store_id: 'MTY-001',  region: 'mty',  manager: 'Patricia Morales' },
];

// 50 customer slots — reused across stores and days
const CUSTOMERS = [
  { id: 'CUST-001', name: 'Juan García' },
  { id: 'CUST-002', name: 'María López' },
  { id: 'CUST-003', name: 'Carlos Hernández' },
  { id: 'CUST-004', name: 'Ana Martínez' },
  { id: 'CUST-005', name: 'Luis Torres' },
  { id: 'CUST-006', name: 'Sofía Ramírez' },
  { id: 'CUST-007', name: 'Miguel Flores' },
  { id: 'CUST-008', name: 'Isabella Morales' },
  { id: 'CUST-009', name: 'José Cruz' },
  { id: 'CUST-010', name: 'Valentina Reyes' },
  { id: 'CUST-011', name: 'Diego Jiménez' },
  { id: 'CUST-012', name: 'Camila Álvarez' },
  { id: 'CUST-013', name: 'Andrés Díaz' },
  { id: 'CUST-014', name: 'Lucía Vásquez' },
  { id: 'CUST-015', name: 'Sebastián Romero' },
  { id: 'CUST-016', name: 'Gabriela Medina' },
  { id: 'CUST-017', name: 'Mateo Castro' },
  { id: 'CUST-018', name: 'Fernanda Vargas' },
  { id: 'CUST-019', name: 'Javier Ruiz' },
  { id: 'CUST-020', name: 'Daniela Ortega' },
  { id: 'CUST-021', name: 'Ricardo Peña' },
  { id: 'CUST-022', name: 'Claudia Herrera' },
  { id: 'CUST-023', name: 'Eduardo Mendoza' },
  { id: 'CUST-024', name: 'Valeria Aguilar' },
  { id: 'CUST-025', name: 'Francisco Guerrero' },
  { id: 'CUST-026', name: 'Natalia Delgado' },
  { id: 'CUST-027', name: 'Alejandro Ibarra' },
  { id: 'CUST-028', name: 'Paola Espinoza' },
  { id: 'CUST-029', name: 'Raúl Soto' },
  { id: 'CUST-030', name: 'Karla Domínguez' },
  { id: 'CUST-031', name: 'Héctor Lara' },
  { id: 'CUST-032', name: 'Verónica Serrano' },
  { id: 'CUST-033', name: 'Óscar Vega' },
  { id: 'CUST-034', name: 'Mariana Fuentes' },
  { id: 'CUST-035', name: 'Arturo Campos' },
  { id: 'CUST-036', name: 'Adriana Ríos' },
  { id: 'CUST-037', name: 'Iván Carrillo' },
  { id: 'CUST-038', name: 'Lorena Silva' },
  { id: 'CUST-039', name: 'Pablo Rojas' },
  { id: 'CUST-040', name: 'Alicia Navarro' },
  { id: 'CUST-041', name: 'Marco Sandoval' },
  { id: 'CUST-042', name: 'Rebeca Pacheco' },
  { id: 'CUST-043', name: 'Ignacio Paredes' },
  { id: 'CUST-044', name: 'Estefanía Montes' },
  { id: 'CUST-045', name: 'Guillermo Acosta' },
  { id: 'CUST-046', name: 'Noemí Cortés' },
  { id: 'CUST-047', name: 'Salvador Pedraza' },
  { id: 'CUST-048', name: 'Leticia Bautista' },
  { id: 'CUST-049', name: 'Ernesto Zamora' },
  { id: 'CUST-050', name: 'Concepción Téllez' },
];

// ---------------------------------------------------------------------------
// Deterministic order layout
// 5 stores × 5 days × 5 orders = 125 orders total
// Order IDs: ORD-0001 … ORD-0125
// Customer IDs cycle through CUST-001 … CUST-050
// Amounts: realistic MXN 150.00–850.00
// ---------------------------------------------------------------------------

// Pre-defined amounts for 5 orders per slot, indexed [storeIdx][dayIdx][orderIdx]
// All values are in MXN cents represented as x.00 numbers, range 150–850.
const AMOUNT_TABLE = [
  // CDMX-001
  [
    [350, 480, 620, 275, 510],   // day 0
    [420, 315, 750, 580, 230],   // day 1
    [660, 195, 445, 810, 380],   // day 2
    [530, 725, 260, 490, 615],   // day 3
    [300, 840, 475, 650, 185],   // day 4
  ],
  // CDMX-002
  [
    [500, 350, 600, 450, 250],   // day 0
    [430, 785, 310, 540, 695],   // day 1
    [600, 500, 600, 450, 400],   // day 2
    [400, 250, 550, 800, 320],   // day 3
    [500, 500, 450, 150, 550],   // day 4
  ],
  // GDL-001
  [
    [750, 150, 400, 500, 460],   // day 0
    [680, 800, 555, 410, 325],   // day 1
    [350, 400, 750, 800, 470],   // day 2
    [490, 820, 275, 700, 360],   // day 3
    [400, 640, 570, 815, 290],   // day 4
  ],
  // GDL-002
  [
    [750, 600, 800, 550, 430],   // day 0
    [300, 350, 800, 550, 350],   // day 1
    [600, 750, 300, 750, 480],   // day 2
    [350, 800, 350, 750, 415],   // day 3
    [680, 350, 400, 250, 400],   // day 4
  ],
  // MTY-001
  [
    [300, 520, 450, 680, 410],   // day 0
    [250, 470, 730, 150, 600],   // day 1
    [800, 345, 615, 270, 490],   // day 2
    [750, 550, 150, 250, 480],   // day 3
    [750, 200, 800, 150, 300],   // day 4
  ],
];

// ---------------------------------------------------------------------------
// Build orders array
// ---------------------------------------------------------------------------

function buildOrders() {
  const orders = [];
  let ordSeq = 1;
  let custIdx = 0;

  for (let si = 0; si < STORES.length; si++) {
    const store = STORES[si];
    for (let di = 0; di < DATES.length; di++) {
      const date = DATES[di];
      for (let oi = 0; oi < 5; oi++) {
        const customer = CUSTOMERS[custIdx % CUSTOMERS.length];
        custIdx++;
        orders.push({
          order_id: `ORD-${String(ordSeq).padStart(4, '0')}`,
          store_id: store.store_id,
          region: store.region,
          customer_id: customer.id,
          customer_name: customer.name,
          order_date: date,
          pickup_date: date,
          expected_amount: AMOUNT_TABLE[si][di][oi].toFixed(2),
          currency: 'MXN',
          payment_method: 'cash_on_pickup',
        });
        ordSeq++;
      }
    }
  }

  return orders;
}

// ---------------------------------------------------------------------------
// Build reports array
// Scenario rules applied per store × day.
// ---------------------------------------------------------------------------

function buildReports(orders) {
  const reports = [];
  let rptSeq = 1;

  // Group orders by [store_id][date]
  // Layout: ordersGrid[storeIdx][dayIdx] = array of 5 orders
  const ordersGrid = [];
  let idx = 0;
  for (let si = 0; si < STORES.length; si++) {
    ordersGrid[si] = [];
    for (let di = 0; di < DATES.length; di++) {
      ordersGrid[si][di] = orders.slice(idx, idx + 5);
      idx += 5;
    }
  }

  for (let si = 0; si < STORES.length; si++) {
    const store = STORES[si];

    for (let di = 0; di < DATES.length; di++) {
      const date = DATES[di];
      const dayOrders = ordersGrid[si][di];
      const exactSum = dayOrders.reduce((s, o) => s + parseFloat(o.expected_amount), 0);

      // ---- MTY-001: no report on day 0 (2024-01-15) and day 2 (2024-01-17) ----
      if (store.store_id === 'MTY-001' && (di === 0 || di === 2)) {
        // Intentionally skip — orders become "unaccounted"
        continue;
      }

      let totalCollected;
      let reportedOrders;

      if (store.store_id === 'CDMX-001') {
        // All days matched
        totalCollected = exactSum;
        reportedOrders = dayOrders;

      } else if (store.store_id === 'CDMX-002') {
        if (di < 4) {
          // Days 0-3: under-collection — omit the LAST order from both list and total
          reportedOrders = dayOrders.slice(0, 4);
          totalCollected = reportedOrders.reduce((s, o) => s + parseFloat(o.expected_amount), 0);
        } else {
          // Day 4 (2024-01-19): matched
          totalCollected = exactSum;
          reportedOrders = dayOrders;
        }

      } else if (store.store_id === 'GDL-001') {
        if (di === 0 || di === 2) {
          // Days 0, 2: over-collection (+200 MXN)
          totalCollected = exactSum + 200;
          reportedOrders = dayOrders;
        } else {
          // Days 1, 3, 4: matched
          totalCollected = exactSum;
          reportedOrders = dayOrders;
        }

      } else if (store.store_id === 'GDL-002') {
        if (di === 0) {
          // Day 0: matched
          totalCollected = exactSum;
          reportedOrders = dayOrders;
        } else if (di === 1) {
          // Day 1: under-collection — omit the LAST order
          reportedOrders = dayOrders.slice(0, 4);
          totalCollected = reportedOrders.reduce((s, o) => s + parseFloat(o.expected_amount), 0);
        } else if (di === 2) {
          // Day 2: matched
          totalCollected = exactSum;
          reportedOrders = dayOrders;
        } else if (di === 3) {
          // Day 3: over-collection (+150 MXN)
          totalCollected = exactSum + 150;
          reportedOrders = dayOrders;
        } else {
          // Day 4: matched
          totalCollected = exactSum;
          reportedOrders = dayOrders;
        }

      } else {
        // MTY-001 days 1, 3, 4: matched
        totalCollected = exactSum;
        reportedOrders = dayOrders;
      }

      reports.push({
        report_id: `RPT-${String(rptSeq).padStart(3, '0')}`,
        store_id: store.store_id,
        report_date: date,
        total_collected: totalCollected.toFixed(2),
        order_ids: reportedOrders.map(o => o.order_id).join(','),
        submitted_by: store.manager,
      });
      rptSeq++;
    }
  }

  return reports;
}

// ---------------------------------------------------------------------------
// CSV serialiser — quotes any field that contains a comma
// ---------------------------------------------------------------------------

function toCsv(rows, columns) {
  const header = columns.join(',');
  const lines = rows.map(row =>
    columns.map(col => {
      const val = String(row[col] ?? '');
      return val.includes(',') ? `"${val}"` : val;
    }).join(',')
  );
  return [header, ...lines].join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const orders  = buildOrders();
const reports = buildReports(orders);

const ordersCsv = toCsv(orders, [
  'order_id', 'store_id', 'region', 'customer_id', 'customer_name',
  'order_date', 'pickup_date', 'expected_amount', 'currency', 'payment_method',
]);

const reportsCsv = toCsv(reports, [
  'report_id', 'store_id', 'report_date', 'total_collected', 'order_ids', 'submitted_by',
]);

const seedDir = join(__dirname, 'seed');
mkdirSync(seedDir, { recursive: true });

writeFileSync(join(seedDir, 'orders.csv'),       ordersCsv,  { encoding: 'utf8' });
writeFileSync(join(seedDir, 'cash_reports.csv'), reportsCsv, { encoding: 'utf8' });

console.log(`Generated ${orders.length} orders  → data/seed/orders.csv`);
console.log(`Generated ${reports.length} reports → data/seed/cash_reports.csv`);
console.log('');
console.log('Store scenarios embedded in seed data:');
console.log('  CDMX-001  cdmx  All 5 days matched (exact totals)');
console.log('  CDMX-002  cdmx  Days 1-4 under-collection (1 order omitted per day); Day 5 matched');
console.log('  GDL-001   gdl   Days 1,3 over-collection (+200 MXN each); Days 2,4,5 matched');
console.log('  GDL-002   gdl   Day1 matched; Day2 under; Day3 matched; Day4 over(+150); Day5 matched');
console.log('  MTY-001   mty   Days 1,3 have NO cash report (unaccounted orders); Days 2,4,5 matched');
