require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { pool } = require('../src/db/pool');

function datasetPath() {
  return process.env.ECI_DATASET_DIR || path.resolve(__dirname, '..', 'data');
}

function loadCsv(fileName) {
  const filePath = path.join(datasetPath(), fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Dataset file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true
  });
}

async function seedNotifications() {
  const rows = loadCsv('eci_orders_indian.csv').slice(0, 300);

  for (const row of rows) {
    const orderId = String(row.order_id);
    const eventType = row.order_status === 'DELIVERED' ? 'SHIPMENT_DELIVERED' : 'ORDER_CONFIRMED';
    const channel = Number(row.customer_id) % 2 === 0 ? 'EMAIL' : 'SMS';
    const recipient = channel === 'EMAIL' ? `customer${row.customer_id}@example.com` : `+9199999${row.customer_id}`;

    await pool.query(
      `INSERT INTO notifications_log
       (order_id, customer_id, event_type, channel, recipient, content, status, idempotency_key, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'SENT', $7, NOW(), NOW())
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [orderId, String(row.customer_id), eventType, channel, recipient, `${eventType} for order ${orderId}`, `seed-notification-${orderId}`]
    );
  }

  console.log(`Seeded notifications rows processed: ${rows.length}`);
}

async function run() {
  try {
    await seedNotifications();
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error('Notification seed failed:', error.message);
  process.exit(1);
});
