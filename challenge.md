# The Offline Payment Paradox: Build Bodega Verde's Cash Reconciliation Engine

## The Scenario

Bodega Verde is a fast-growing retail chain in Mexico with **150+ physical stores** across Mexico City, Guadalajara, and Monterrey. They recently launched online ordering with in-store pickup, and it's been a massive hit — but there's a critical problem.

**70% of their customers choose cash payment on pickup** (a common preference in Latin American markets), but Bodega Verde's finance team is drowning in manual reconciliation work. Every day, store managers submit handwritten reports of cash payments collected. The finance team then manually matches these against the orders placed online, but the process is error-prone and takes **3-5 business days** to complete.

### The Impact Is Severe

| Issue | Detail |
|---|---|
| Discrepancy rate | ~8% between reported cash collections and expected amounts |
| Unreconciled transactions | $45,000 USD last month alone |
| Manager overhead | 2+ hours daily on paperwork instead of customer service |
| Visibility gaps | No insight into which stores/employees have cash handling issues |
| Reporting delays | Delayed financial reporting affecting investor confidence |

You've been brought in to build a backend system that can **ingest order data and cash collection reports**, automatically reconcile them, flag discrepancies, and provide the finance team with actionable insights.

---

## Domain Background: Understanding Offline Payment Methods

### What Are Cash-Based Payment Methods?

In many emerging markets, cash remains the dominant payment method. For e-commerce and omnichannel retail, this creates unique challenges:

**Cash on Delivery (COD) / Cash on Pickup:** The customer places an order online but pays in cash when receiving the product. The merchant must:

1. Track which orders are pending payment
2. Confirm when cash is actually collected
3. Match the physical cash received to the digital order
4. Deposit the cash and update accounting systems

> **Why This Matters:** Unlike card payments where authorization and settlement happen digitally, cash payments create a **"reconciliation gap"** between the digital order and the physical money. If a customer says they paid but the store says they didn't receive payment, or if cash goes missing between collection and deposit — these are the problems that cause revenue leakage.

### Key Reconciliation Concepts

**Expected vs. Actual:**

- **Expected amount:** What the system says should have been collected (sum of all orders marked for cash pickup)
- **Actual amount:** What the store manager reports was physically collected
- **Variance/Discrepancy:** The difference between expected and actual

**Reconciliation Status:**

| Status | Description |
|---|---|
| `matched` | Expected amount = Actual amount for a given order |
| `over_collection` | Store reported more cash than expected (duplicate payments or errors) |
| `under_collection` | Store reported less cash than expected (potential theft, disputes, or unreported discounts) |
| `unaccounted` | Order exists but no cash collection was reported |

**Reconciliation Window:** The time period you're matching. Daily reconciliation (matching today's orders to today's cash reports) is standard, but stores might submit reports late.

---

## Your Mission

Build a backend service and data processing engine that **automates Bodega Verde's cash payment reconciliation workflow**. The system should ingest order data and store cash reports, match them intelligently, calculate discrepancies, and expose the results via an API that the finance team's existing tools can consume.

---

## Functional Requirements

### Requirement 1: Data Ingestion & Storage

Your system must be able to:

- Accept order data (either by reading files, consuming an API endpoint you create, or any ingestion method you choose)
- Accept cash collection reports from stores
- Store this data in a way that supports efficient querying and reconciliation

**✅ Done when:** A reviewer can submit sample order data and cash reports to your system (via API, file upload, CLI, or any method you document), and the system persists this data correctly.

---

### Requirement 2: Automated Reconciliation Logic

Your system must:

- Match cash collection reports to orders based on **order ID**, **store ID**, and **collection date**
- Calculate the expected cash amount for each store per day (sum of all cash-on-pickup orders)
- Compare expected vs. actual collected amounts
- Categorize discrepancies (`over`, `under`, `unaccounted`)
- Calculate variance amounts and percentages

**✅ Done when:** Given a set of orders and cash reports, the system produces a reconciliation summary showing which transactions matched perfectly, which have discrepancies, and the magnitude of each discrepancy.

---

### Requirement 3: Query & Reporting API

Expose an API (REST, GraphQL, or any format you choose) that allows the finance team to:

- Retrieve reconciliation status for a specific date or date range
- Filter by store ID or region
- Get a list of all discrepancies above a certain threshold
- View details for a specific order (expected amount, actual collected, status, timestamps)

**✅ Done when:** A reviewer can use your API (via curl, Postman, HTTP requests, or a simple client you provide) to query reconciliation data and get structured, useful responses. Include **at least 3 different query capabilities**.

---

## Stretch Goals _(Partial completion expected and welcomed)_

- **Discrepancy Alerts:** Flag "high-priority" discrepancies (e.g., variance > $100 USD or > 10% of expected amount) and separate them from minor rounding errors.
- **Trend Analysis:** Endpoint returning aggregate statistics — which stores have the highest discrepancy rates over time, which days of the week see the most issues, average reconciliation accuracy per store.
- **Batch Reconciliation:** Support uploading and processing multiple days of data at once, with a summary report across all days.
- **Timezone & Multi-Currency Support:** Support for different time zones and currencies for future expansion to Colombia or Brazil (current test data can be MXN only).

---

## Test Data Requirements

Your test dataset should include:

- **At least 100 orders** across **at least 5 different store IDs**
- Orders spanning **3-7 days** of dates
- Each order must include:
  - `order_id`, `store_id`, `customer_name`/`customer_id` (can be fake)
  - `order_date`, `pickup_date` (same day or next day)
  - `expected_payment_amount` (in MXN)
  - `payment_method` (all should be `cash_on_pickup`)
- Cash collection reports from each store for each day:
  - `store_id`, `date`, `total_cash_collected`, list of `order_ids` that were picked up and paid
- **Scenario requirements:**
  - Some reports with perfect matches
  - Some with under-collection (missing orders)
  - Some with over-collection (duplicate recordings)
  - **At least 2-3 unaccounted orders** (order exists but no cash report mentions it)
  - At least one store with consistently accurate reporting and one with frequent issues

---

## Acceptance Criteria

A reviewer must be able to:

- ✅ Load test data into the system (using whatever ingestion method you've built)
- ✅ Trigger reconciliation (automatically on ingestion, via API call, or script)
- ✅ Query the API to see:
  - All orders for a specific store on a specific date
  - All discrepancies above a certain amount
  - Reconciliation status summary for a date range
- ✅ Observe that the system correctly identifies mismatches and calculates variance
- ✅ Read your documentation and understand how to run and test the system

---

## Deliverables

Submit your solution as a **Git repository** (GitHub, GitLab, etc.) or ZIP file containing:

1. Source code for your backend service and reconciliation logic
2. Test data files (or scripts to generate them)
3. `README.md` with:
   - Setup and installation instructions
   - How to load test data
   - How to run the service
   - API documentation (endpoints, request/response examples)
   - Architecture overview (high-level explanation of your approach)
   - A short demo script or example queries showing how to use the API
   - Design decisions, trade-offs, and what you'd improve with more time

---

## Evaluation Criteria

| Category | Points |
|---|---|
| Reconciliation Logic Correctness | 25 pts |
| Data Ingestion & Storage | 15 pts |
| API Design & Functionality | 20 pts |
| Code Quality | 15 pts |
| Documentation & Demo | 15 pts |
| Stretch Goals & Innovation | 10 pts |
| **Total** | **100 pts** |

---

## Evaluation Notes

- **No UI needed.** This is a backend challenge. A well-documented API is sufficient.
- **Technology choices are yours.** Use any language, framework, database, or tools you're comfortable with.
- **"Production-ready" is not expected.** Focus on clear logic, working functionality, and good documentation over perfect error handling or scalability.
- **Partial completion is valued.** If you complete the 3 core requirements well, that's a strong submission.
- **Code clarity matters.** We care more about readable, well-structured code than clever optimizations.

---

> Good luck, and think like a Bodega Verde finance manager who's been manually reconciling spreadsheets for months — build something that would make their life dramatically easier! 🚀
