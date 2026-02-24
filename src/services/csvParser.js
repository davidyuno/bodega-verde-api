import { parse } from 'csv-parse/sync';

const ORDER_REQUIRED_COLUMNS = [
  'order_id', 'store_id', 'region', 'customer_id', 'customer_name',
  'order_date', 'pickup_date', 'expected_amount', 'currency', 'payment_method',
];

const REPORT_REQUIRED_COLUMNS = [
  'report_id', 'store_id', 'report_date', 'total_collected', 'order_ids', 'submitted_by',
];

function parseCsv(buffer) {
  return parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
  });
}

function validateColumns(records, required) {
  if (records.length === 0) throw Object.assign(new Error('CSV file is empty'), { status: 400 });
  const headers = Object.keys(records[0]);
  const missing = required.filter(c => !headers.includes(c));
  if (missing.length > 0) {
    throw Object.assign(
      new Error(`Missing required columns: ${missing.join(', ')}`),
      { status: 400 }
    );
  }
}

export function parseOrdersCsv(buffer) {
  const records = parseCsv(buffer);
  validateColumns(records, ORDER_REQUIRED_COLUMNS);

  return records.map((row, i) => {
    const amount = parseFloat(row.expected_amount);
    if (isNaN(amount) || amount < 0) {
      throw Object.assign(
        new Error(`Row ${i + 2}: invalid expected_amount "${row.expected_amount}"`),
        { status: 400 }
      );
    }
    if (!row.order_id?.trim()) {
      throw Object.assign(new Error(`Row ${i + 2}: order_id is required`), { status: 400 });
    }
    return {
      order_id: row.order_id.trim(),
      store_id: row.store_id.trim(),
      region: row.region.trim().toLowerCase(),
      customer_id: row.customer_id.trim(),
      customer_name: row.customer_name.trim(),
      order_date: row.order_date.trim(),
      pickup_date: row.pickup_date.trim(),
      expected_amount: amount,
      currency: (row.currency || 'MXN').trim().toUpperCase(),
      payment_method: row.payment_method.trim(),
    };
  });
}

export function parseCashReportsCsv(buffer) {
  const records = parseCsv(buffer);
  validateColumns(records, REPORT_REQUIRED_COLUMNS);

  return records.map((row, i) => {
    const total = parseFloat(row.total_collected);
    if (isNaN(total) || total < 0) {
      throw Object.assign(
        new Error(`Row ${i + 2}: invalid total_collected "${row.total_collected}"`),
        { status: 400 }
      );
    }
    if (!row.report_id?.trim()) {
      throw Object.assign(new Error(`Row ${i + 2}: report_id is required`), { status: 400 });
    }
    // order_ids can be a quoted CSV list or JSON array
    let orderIds;
    const raw = row.order_ids.trim();
    if (raw.startsWith('[')) {
      orderIds = JSON.parse(raw);
    } else {
      orderIds = raw.split(',').map(s => s.trim()).filter(Boolean);
    }
    return {
      report_id: row.report_id.trim(),
      store_id: row.store_id.trim(),
      report_date: row.report_date.trim(),
      total_collected: total,
      order_ids: orderIds,
      submitted_by: row.submitted_by.trim(),
    };
  });
}
