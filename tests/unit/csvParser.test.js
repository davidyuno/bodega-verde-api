import { describe, it, expect } from 'vitest';
import { parseOrdersCsv, parseCashReportsCsv } from '../../src/services/csvParser.js';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const VALID_ORDERS_CSV = [
  'order_id,store_id,region,customer_id,customer_name,order_date,pickup_date,expected_amount,currency,payment_method',
  'ORD-001,STORE-001,cdmx,CUST-001,Juan García,2024-01-15,2024-01-15,450.00,MXN,cash_on_pickup',
  'ORD-002,STORE-001,CDMX,CUST-002,María López,2024-01-15,2024-01-15,300.00,MXN,cash_on_pickup',
].join('\n');

const VALID_REPORTS_CSV = [
  'report_id,store_id,report_date,total_collected,order_ids,submitted_by',
  'RPT-001,STORE-001,2024-01-15,750.00,"ORD-001,ORD-002",Manager-001',
].join('\n');

// ---------------------------------------------------------------------------
// parseOrdersCsv
// ---------------------------------------------------------------------------

describe('parseOrdersCsv', () => {
  // 1. Valid CSV
  it('parses a valid orders CSV buffer and coerces field types', () => {
    const rows = parseOrdersCsv(Buffer.from(VALID_ORDERS_CSV));

    expect(rows).toHaveLength(2);
    expect(rows[0].order_id).toBe('ORD-001');
    // expected_amount must be a number, not a string
    expect(typeof rows[0].expected_amount).toBe('number');
    expect(rows[0].expected_amount).toBe(450);
    // region must be lowercased regardless of input casing
    expect(rows[0].region).toBe('cdmx');
    expect(rows[1].region).toBe('cdmx'); // was 'CDMX' in the fixture
  });

  // 2. Missing required column
  it('throws with status 400 when a required column is absent', () => {
    const bad = [
      'order_id,store_id,region,customer_id,customer_name,order_date,pickup_date,currency,payment_method',
      'ORD-001,STORE-001,cdmx,CUST-001,Juan,2024-01-15,2024-01-15,MXN,cash_on_pickup',
    ].join('\n'); // missing expected_amount

    expect(() => parseOrdersCsv(Buffer.from(bad))).toThrow(
      expect.objectContaining({ status: 400 }),
    );
  });

  // 3. Empty CSV (header-only — no data rows)
  it('throws with status 400 for a header-only (empty) CSV', () => {
    const headerOnly =
      'order_id,store_id,region,customer_id,customer_name,order_date,pickup_date,expected_amount,currency,payment_method\n';

    expect(() => parseOrdersCsv(Buffer.from(headerOnly))).toThrow(
      expect.objectContaining({ status: 400 }),
    );
  });

  // 4. Invalid expected_amount
  it('throws with status 400 when expected_amount is not numeric', () => {
    const bad = VALID_ORDERS_CSV.replace('450.00', 'abc');

    const thrown = (() => {
      try {
        parseOrdersCsv(Buffer.from(bad));
      } catch (e) {
        return e;
      }
    })();

    expect(thrown).toBeDefined();
    expect(thrown.status).toBe(400);
    expect(thrown.message).toMatch(/invalid expected_amount/i);
  });
});

// ---------------------------------------------------------------------------
// parseCashReportsCsv
// ---------------------------------------------------------------------------

describe('parseCashReportsCsv', () => {
  // 5. Valid CSV with comma-separated (quoted) order_ids
  it('parses order_ids from a quoted comma-separated field into an array', () => {
    const rows = parseCashReportsCsv(Buffer.from(VALID_REPORTS_CSV));

    expect(rows).toHaveLength(1);
    expect(rows[0].order_ids).toEqual(['ORD-001', 'ORD-002']);
    expect(rows[0].total_collected).toBe(750);
  });

  // 6. Valid CSV with JSON-array order_ids
  it('parses order_ids from a JSON-array formatted field into an array', () => {
    const csv = [
      'report_id,store_id,report_date,total_collected,order_ids,submitted_by',
      'RPT-002,STORE-001,2024-01-15,200.00,"[""ORD-003"",""ORD-004""]",Manager-001',
    ].join('\n');

    const rows = parseCashReportsCsv(Buffer.from(csv));

    expect(rows[0].order_ids).toBeInstanceOf(Array);
    expect(rows[0].order_ids).toHaveLength(2);
    expect(rows[0].order_ids[0]).toBe('ORD-003');
    expect(rows[0].order_ids[1]).toBe('ORD-004');
  });

  // 7. Missing required column
  it('throws with status 400 when a required column is missing', () => {
    const bad = [
      'report_id,store_id,report_date',
      'RPT-001,STORE-001,2024-01-15',
    ].join('\n'); // missing total_collected, order_ids, submitted_by

    expect(() => parseCashReportsCsv(Buffer.from(bad))).toThrow(
      expect.objectContaining({ status: 400 }),
    );
  });
});
