# Bodega Verde — Cash Reconciliation Engine: Development Plan

## Stack & Tools

| Layer | Choice | Reason |
|---|---|---|
| Runtime | Node.js (ESM) | Required by criteria |
| Framework | Express.js | Lightweight, wide ecosystem |
| Database | SQLite (via `better-sqlite3`) | Zero-config, file-based, perfect for Vercel via persistent volume or in-memory for demo |
| ORM | Drizzle ORM | Type-safe, lightweight, great SQLite support |
| Validation | Zod | Schema validation for API inputs |
| CSV parsing | `csv-parse` | Robust CSV parsing, strict `.csv`-only enforcement |
| API docs | Swagger (swagger-ui-express + swagger-jsdoc) | In-app interactive docs |
| Testing | Vitest + supertest | Fast unit + integration tests |
| Deploy | Vercel (serverless functions) | Required by criteria |
| Repo | GitHub | Required by criteria |

---

## Repository Structure

```
bodega-verde-api/
├── api/                      # Vercel serverless entry point
│   └── index.js
├── src/
│   ├── db/
│   │   ├── schema.js         # Drizzle schema definitions
│   │   ├── migrate.js        # DB initialization / migrations
│   │   └── index.js          # DB connection singleton
│   ├── routes/
│   │   ├── ingest.js         # POST /ingest/orders, POST /ingest/cash-reports
│   │   ├── reconciliation.js # POST /reconcile, GET /reconciliation/...
│   │   ├── orders.js         # GET /orders/...
│   │   └── analytics.js      # GET /analytics/... (stretch)
│   ├── services/
│   │   ├── csvParser.js      # CSV parsing + validation (only .csv allowed)
│   │   ├── reconciler.js     # Core reconciliation logic
│   │   └── alerting.js       # High-priority discrepancy detection (stretch)
│   ├── middleware/
│   │   ├── errorHandler.js
│   │   └── upload.js         # Multer config — .csv only, max 5MB
│   ├── swagger.js            # Swagger/OpenAPI config
│   └── app.js                # Express app factory
├── data/
│   ├── seed/
│   │   ├── orders.csv        # 100+ orders across 5+ stores, 5-7 days
│   │   └── cash_reports.csv  # Matching cash reports with intentional discrepancies
│   └── generate-seed.js      # Script to regenerate seed data
├── tests/
│   ├── unit/
│   │   ├── reconciler.test.js
│   │   └── csvParser.test.js
│   └── integration/
│       ├── ingest.test.js
│       ├── reconciliation.test.js
│       └── orders.test.js
├── vercel.json               # Vercel routing config
├── .env.example
├── package.json
└── README.md
```

---

## Data Models

### `orders` table

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `order_id` | TEXT UNIQUE | Business order ID |
| `store_id` | TEXT | e.g., `CDMX-001` |
| `region` | TEXT | `cdmx`, `gdl`, `mty` |
| `customer_id` | TEXT | |
| `customer_name` | TEXT | |
| `order_date` | TEXT | ISO date `YYYY-MM-DD` |
| `pickup_date` | TEXT | ISO date |
| `expected_amount` | REAL | MXN |
| `currency` | TEXT | Default `MXN` |
| `timezone` | TEXT | Default `America/Mexico_City` |
| `payment_method` | TEXT | Always `cash_on_pickup` |
| `created_at` | TEXT | ISO timestamp |

### `cash_reports` table

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `report_id` | TEXT UNIQUE | Business report ID |
| `store_id` | TEXT | |
| `report_date` | TEXT | ISO date |
| `total_collected` | REAL | MXN |
| `order_ids` | TEXT | JSON array of order IDs |
| `submitted_by` | TEXT | Store manager name |
| `created_at` | TEXT | |

### `reconciliations` table

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `order_id` | TEXT | FK → orders.order_id |
| `report_id` | TEXT | FK → cash_reports.report_id (nullable) |
| `store_id` | TEXT | |
| `reconciliation_date` | TEXT | ISO date |
| `expected_amount` | REAL | |
| `actual_amount` | REAL | Nullable if unaccounted |
| `variance_amount` | REAL | actual - expected |
| `variance_pct` | REAL | variance / expected * 100 |
| `status` | TEXT | `matched`, `over_collection`, `under_collection`, `unaccounted` |
| `is_high_priority` | INTEGER | 1 if |variance| > 100 or |variance_pct| > 10% |
| `reconciled_at` | TEXT | |

---

## API Endpoints

### Ingestion

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/ingest/orders` | Upload orders `.csv` file |
| `POST` | `/api/ingest/cash-reports` | Upload cash reports `.csv` file |

**CSV-only enforcement:** Multer middleware rejects any file whose MIME type is not `text/csv` and whose extension is not `.csv`. Returns `400` with a clear error message.

**CSV format — orders.csv:**
```
order_id,store_id,region,customer_id,customer_name,order_date,pickup_date,expected_amount,currency,payment_method
ORD-0001,CDMX-001,cdmx,CUST-001,Juan García,2024-01-15,2024-01-15,450.00,MXN,cash_on_pickup
```

**CSV format — cash_reports.csv:**
```
report_id,store_id,report_date,total_collected,order_ids,submitted_by
RPT-001,CDMX-001,2024-01-15,1350.00,"ORD-0001,ORD-0002,ORD-0003",María López
```

---

### Reconciliation

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/reconcile` | Trigger reconciliation (body: `{ date?, store_id? }`) |
| `POST` | `/api/reconcile/batch` | Reconcile a date range `{ from, to, store_id? }` (stretch) |

---

### Query & Reporting _(at least 3 required)_

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/orders` | List orders — query: `store_id`, `date`, `status`, `page`, `limit` |
| `GET` | `/api/orders/:order_id` | Order detail with reconciliation status |
| `GET` | `/api/reconciliation/summary` | Summary for date range — query: `from`, `to`, `store_id`, `region` |
| `GET` | `/api/reconciliation/discrepancies` | All discrepancies — query: `min_variance`, `store_id`, `from`, `to`, `priority` |
| `GET` | `/api/reconciliation/status` | Per-order reconciliation list — query: `date`, `store_id`, `status` |
| `GET` | `/api/analytics/stores` | Trend: discrepancy rates per store over time (stretch) |
| `GET` | `/api/analytics/daily` | Trend: daily accuracy across all stores (stretch) |

---

### Docs & Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/docs` | Swagger UI |

---

## Reconciliation Logic (Core Algorithm)

```
reconcile(date, store_id?) →
  1. Fetch all orders WHERE pickup_date = date [AND store_id]
  2. Fetch all cash_reports WHERE report_date = date [AND store_id]
  3. For each cash_report:
       a. Parse order_ids JSON array
       b. For each order_id in report:
            - Find matching order
            - If order found → mark as referenced by this report
  4. For each order:
       - Find the report that references this order_id
       - If no report → status = "unaccounted", actual = null
       - If referenced → compare order.expected_amount vs proportional share
  5. Per store/day aggregate:
       - expected = SUM(order.expected_amount) for all orders
       - actual   = cash_report.total_collected
       - variance = actual - expected
       - variance_pct = (variance / expected) * 100
       - status:
           variance == 0  → "matched"
           variance > 0   → "over_collection"
           variance < 0   → "under_collection"
  6. is_high_priority = |variance| > 100 OR |variance_pct| > 10
  7. Upsert into reconciliations table
```

---

## Test Data Strategy

The `data/seed/` directory contains pre-generated CSV files and a `generate-seed.js` script.

### Seed scenario design:

| Store | Region | Behavior |
|---|---|---|
| `CDMX-001` | cdmx | Consistently accurate — all matched |
| `CDMX-002` | cdmx | Frequent under-collection (missing 1-2 orders per day) |
| `GDL-001` | gdl | Occasional over-collection (duplicate entries) |
| `GDL-002` | gdl | Mix of matched and discrepancies |
| `MTY-001` | mty | Has 2-3 completely unaccounted orders |

- 100+ orders spread across 5 days (Mon-Fri)
- Each day has 4-6 orders per store
- Intentional discrepancy scenarios embedded in seed data

---

## Testing Plan

### Unit Tests (`tests/unit/`)

- `reconciler.test.js` — reconciliation logic with mocked DB responses
  - Perfect match scenario
  - Under-collection scenario
  - Over-collection scenario
  - Unaccounted order scenario
  - High-priority flagging (>$100 / >10%)
- `csvParser.test.js` — CSV validation
  - Rejects non-`.csv` files
  - Validates required columns
  - Handles malformed rows gracefully

### Integration Tests (`tests/integration/`)

- `ingest.test.js` — file upload endpoints
  - Successful orders CSV upload
  - Successful cash reports CSV upload
  - Rejects `.xlsx` / `.json` / `.txt` files
  - Rejects CSV with missing required columns
- `reconciliation.test.js` — reconciliation API
  - POST `/reconcile` runs correctly
  - GET summary returns correct aggregates
  - GET discrepancies filters by `min_variance`
- `orders.test.js` — order query API
  - Filter by store + date
  - Single order detail endpoint

---

## Vercel Deployment

```json
// vercel.json
{
  "version": 2,
  "builds": [{ "src": "api/index.js", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "api/index.js" }]
}
```

- Database: SQLite file stored at `/tmp/bodega.db` on Vercel (ephemeral, resets on cold start — acceptable for demo purposes; note in README)
- Alternatively: use Vercel KV or Turso (libSQL) for persistence

---

## Development Phases

### Phase 1 — Project Setup
- [ ] Create GitHub repo (`bodega-verde-api`)
- [ ] Init Node.js project (`npm init`)
- [ ] Install dependencies
- [ ] Configure ESLint + `.env.example`
- [ ] Set up Vercel project
- [ ] `git commit: chore: initial project setup`

### Phase 2 — Database & Schema
- [ ] Define Drizzle schema (`orders`, `cash_reports`, `reconciliations`)
- [ ] DB connection singleton with init/migration logic
- [ ] `git commit: feat: database schema and migration`

### Phase 3 — CSV Ingestion
- [ ] Multer upload middleware — `.csv` only enforcement
- [ ] `csvParser.js` service — parse, validate, and normalize rows
- [ ] `POST /api/ingest/orders` route
- [ ] `POST /api/ingest/cash-reports` route
- [ ] `git commit: feat: CSV ingestion endpoints`

### Phase 4 — Reconciliation Engine
- [ ] `reconciler.js` service — core matching algorithm
- [ ] `POST /api/reconcile` route (single date)
- [ ] `POST /api/reconcile/batch` route (date range stretch)
- [ ] `alerting.js` — high-priority flagging
- [ ] `git commit: feat: reconciliation engine`

### Phase 5 — Query & Reporting API
- [ ] `GET /api/orders` with filters
- [ ] `GET /api/orders/:order_id`
- [ ] `GET /api/reconciliation/summary`
- [ ] `GET /api/reconciliation/discrepancies`
- [ ] `GET /api/reconciliation/status`
- [ ] `git commit: feat: query and reporting endpoints`

### Phase 6 — Analytics (Stretch)
- [ ] `GET /api/analytics/stores` — trend per store
- [ ] `GET /api/analytics/daily` — daily accuracy trend
- [ ] `git commit: feat: analytics endpoints`

### Phase 7 — Seed Data
- [ ] Write `generate-seed.js` script
- [ ] Generate `orders.csv` (100+ rows, 5 stores, 5-7 days)
- [ ] Generate `cash_reports.csv` (with intentional discrepancies)
- [ ] `git commit: data: add seed data and generator script`

### Phase 8 — Swagger Docs
- [ ] Configure `swagger-jsdoc` with JSDoc annotations on all routes
- [ ] Mount Swagger UI at `/api/docs`
- [ ] `git commit: docs: add Swagger UI`

### Phase 9 — Tests
- [ ] Unit tests: reconciler + csvParser
- [ ] Integration tests: ingest + reconciliation + orders
- [ ] Verify all tests pass (`npm test`)
- [ ] `git commit: test: unit and integration test suite`

### Phase 10 — README & Deploy
- [ ] Write comprehensive `README.md`
- [ ] Deploy to Vercel
- [ ] Add live URL to README
- [ ] `git commit: docs: README and deployment config`

---

## README Outline

1. **Overview** — What this project does (2 sentences)
2. **Architecture** — Diagram/description: Express → SQLite/Drizzle → Reconciler
3. **Prerequisites** — Node.js 18+, npm
4. **Installation** — `git clone`, `npm install`, `cp .env.example .env`
5. **Running locally** — `npm run dev`
6. **Loading test data** — How to upload the seed CSVs via API
7. **Triggering reconciliation** — `POST /api/reconcile`
8. **API reference** — Table of all endpoints with example curl commands
9. **Swagger UI** — Link to `/api/docs`
10. **Running tests** — `npm test`
11. **Deploy to Vercel** — `vercel --prod`
12. **Design decisions & trade-offs**
13. **What I'd improve with more time**

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| SQLite over Postgres | Zero external deps, works on Vercel `/tmp`, easy to demo |
| CSV upload only (no JSON bulk) | Matches real-world finance workflow; aligns with challenge spec |
| Auto-reconcile on ingest option | Can trigger reconciliation automatically when reports are uploaded |
| Drizzle ORM | Type-safe queries without heavy overhead |
| Vercel serverless | Instant deploy, free tier, matches criteria |
| Vitest over Jest | Faster, native ESM support, better DX |
