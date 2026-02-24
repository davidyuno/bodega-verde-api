# Bodega Verde — Cash Reconciliation Engine

A backend API that automates cash payment reconciliation for Bodega Verde's 150+ physical stores. Ingests order data and cash collection reports via CSV upload, matches them, flags discrepancies, and exposes results through a queryable REST API.

**Live API:** https://bodega-verde-api.vercel.app
**Swagger UI:** https://bodega-verde-api.vercel.app/api/docs

---

## Architecture

```
CSV Upload → Multer (.csv only) → csv-parse → SQLite (via Drizzle ORM)
                                                        ↓
                                             Reconciliation Engine
                                                        ↓
                                              REST API (Express)
                                                        ↓
                                             Swagger UI / curl
```

**Stack:**
- **Runtime:** Node.js 18+ (ESM)
- **Framework:** Express.js
- **Database:** SQLite via `better-sqlite3` + Drizzle ORM
- **Validation:** Zod
- **File upload:** Multer (`.csv` only)
- **CSV parsing:** `csv-parse`
- **API docs:** Swagger UI (`swagger-jsdoc` + `swagger-ui-express`)
- **Tests:** Vitest + supertest
- **Deploy:** Vercel (serverless)

---

## Prerequisites

- Node.js >= 18
- npm >= 9

---

## Installation

```bash
git clone https://github.com/davidyuno/bodega-verde-api.git
cd bodega-verde-api
npm install
cp .env.example .env
```

---

## Running Locally

```bash
npm run dev
```

Server starts at `http://localhost:3000`.
Swagger UI: `http://localhost:3000/api/docs`

---

## Loading Test Data

The `data/seed/` directory contains pre-generated CSVs with 100+ orders across 5 stores and 5 days, including intentional discrepancy scenarios.

**Step 1 — Upload orders:**
```bash
curl -X POST http://localhost:3000/api/ingest/orders \
  -F "file=@data/seed/orders.csv"
```

**Step 2 — Upload cash reports:**
```bash
curl -X POST http://localhost:3000/api/ingest/cash-reports \
  -F "file=@data/seed/cash_reports.csv"
```

**Step 3 — Trigger reconciliation:**
```bash
# Reconcile all data
curl -X POST http://localhost:3000/api/reconcile \
  -H "Content-Type: application/json" \
  -d '{}'

# Reconcile a specific date
curl -X POST http://localhost:3000/api/reconcile \
  -H "Content-Type: application/json" \
  -d '{"date": "2024-01-15"}'

# Reconcile a specific store on a specific date
curl -X POST http://localhost:3000/api/reconcile \
  -H "Content-Type: application/json" \
  -d '{"date": "2024-01-15", "store_id": "CDMX-001"}'
```

> **Note:** Only `.csv` files are accepted. Uploading `.xlsx`, `.json`, or any other format returns a `400` error.

---

## API Reference

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |

```bash
curl http://localhost:3000/api/health
```

---

### Ingestion

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/ingest/orders` | Upload orders CSV |
| `POST` | `/api/ingest/cash-reports` | Upload cash reports CSV |

**Orders CSV columns:**
```
order_id, store_id, region, customer_id, customer_name, order_date, pickup_date, expected_amount, currency, payment_method
```

**Cash reports CSV columns:**
```
report_id, store_id, report_date, total_collected, order_ids, submitted_by
```

---

### Reconciliation

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/reconcile` | Trigger reconciliation |
| `POST` | `/api/reconcile/batch` | Reconcile a date range |
| `GET` | `/api/reconciliation/summary` | Summary by date range |
| `GET` | `/api/reconciliation/discrepancies` | All discrepancies |
| `GET` | `/api/reconciliation/status` | Per-order status list |

**Query parameters — `/api/reconciliation/summary`:**

| Param | Type | Example |
|---|---|---|
| `from` | date | `2024-01-15` |
| `to` | date | `2024-01-19` |
| `store_id` | string | `CDMX-001` |
| `region` | string | `cdmx` |

```bash
curl "http://localhost:3000/api/reconciliation/summary?from=2024-01-15&to=2024-01-19"
```

**Query parameters — `/api/reconciliation/discrepancies`:**

| Param | Type | Example |
|---|---|---|
| `min_variance` | number | `100` |
| `store_id` | string | `GDL-001` |
| `from` | date | `2024-01-15` |
| `to` | date | `2024-01-19` |
| `priority` | boolean | `true` |

```bash
# All discrepancies over $100 MXN
curl "http://localhost:3000/api/reconciliation/discrepancies?min_variance=100"

# High-priority only
curl "http://localhost:3000/api/reconciliation/discrepancies?priority=true"
```

---

### Orders

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/orders` | List orders with filters |
| `GET` | `/api/orders/:order_id` | Order detail + reconciliation status |

```bash
# Orders for a specific store on a specific date
curl "http://localhost:3000/api/orders?store_id=CDMX-001&date=2024-01-15"

# Order detail
curl "http://localhost:3000/api/orders/ORD-0001"
```

---

### Analytics (Stretch Goals)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/analytics/stores` | Discrepancy rates per store over time |
| `GET` | `/api/analytics/daily` | Daily accuracy across all stores |

```bash
curl "http://localhost:3000/api/analytics/stores"
curl "http://localhost:3000/api/analytics/daily?from=2024-01-15&to=2024-01-19"
```

---

## Demo Script

Run the full demo end-to-end:

```bash
BASE=http://localhost:3000

# 1. Upload seed data
curl -sX POST $BASE/api/ingest/orders -F "file=@data/seed/orders.csv" | jq .
curl -sX POST $BASE/api/ingest/cash-reports -F "file=@data/seed/cash_reports.csv" | jq .

# 2. Trigger reconciliation for full dataset
curl -sX POST $BASE/api/reconcile -H "Content-Type: application/json" -d '{}' | jq .

# 3. View reconciliation summary for the week
curl -s "$BASE/api/reconciliation/summary?from=2024-01-15&to=2024-01-19" | jq .

# 4. Get all discrepancies above $50 MXN
curl -s "$BASE/api/reconciliation/discrepancies?min_variance=50" | jq .

# 5. Get high-priority discrepancies only
curl -s "$BASE/api/reconciliation/discrepancies?priority=true" | jq .

# 6. Orders for the problem store on day 1
curl -s "$BASE/api/orders?store_id=CDMX-002&date=2024-01-15" | jq .

# 7. Store-level trend analysis
curl -s "$BASE/api/analytics/stores" | jq .
```

---

## Seed Data Scenarios

| Store | Region | Behavior |
|---|---|---|
| `CDMX-001` | cdmx | Consistently accurate — all matched |
| `CDMX-002` | cdmx | Frequent under-collection (missing orders) |
| `GDL-001` | gdl | Occasional over-collection (duplicates) |
| `GDL-002` | gdl | Mix of matched and discrepancies |
| `MTY-001` | mty | 2-3 completely unaccounted orders |

Regenerate seed data:
```bash
npm run seed
```

---

## Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage
```

---

## Deploy to Vercel

```bash
npm i -g vercel
vercel --prod
```

> **SQLite on Vercel:** The database is stored at `/tmp/bodega.db` on Vercel's serverless environment. This is ephemeral — it resets on cold starts. For a production setup, replace SQLite with [Turso](https://turso.tech) (libSQL) or a managed Postgres instance.

---

## Design Decisions & Trade-offs

| Decision | Rationale |
|---|---|
| SQLite over Postgres | Zero external dependencies, works locally and on Vercel `/tmp`, ideal for a demo/challenge |
| CSV upload only | Matches real-world finance workflow; enforced at middleware level (Multer + extension check) |
| Drizzle ORM | Lightweight, type-safe, great SQLite support without heavy configuration |
| Auto-reconcile option | `POST /reconcile` can target all unreconciled data or a specific date/store |
| Variance flagged at >$100 or >10% | Matches the stretch goal threshold from the challenge spec |
| ESM modules | Modern Node.js, cleaner imports, native Vitest support |

## What I'd Improve With More Time

- Replace SQLite with Turso (persistent libSQL) for Vercel production deploys
- Add pagination cursors instead of offset-based pagination
- Add webhook notifications when high-priority discrepancies are detected
- Add a `/api/reconcile/auto` mode that runs on a cron schedule
- Add multi-currency conversion using live exchange rates
- Role-based access control (store managers vs. finance team)
