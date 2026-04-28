const express = require('express');
const { pool } = require('../db/pool');
const { notificationsSentTotal } = require('../metrics');

const router = express.Router();

function parsePagination(query) {
  const page = Math.max(parseInt(query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(query.limit || '10', 10), 1), 100);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

router.post('/', async (req, res, next) => {
  const idempotencyKey = req.header('Idempotency-Key');
  if (!idempotencyKey) {
    return next({ status: 400, code: 'VALIDATION_ERROR', message: 'Idempotency-Key header is required' });
  }

  const { channel, event_type, recipient, content, order_id, customer_id } = req.body;
  if (!channel || !event_type || !recipient || !content) {
    return next({ status: 400, code: 'VALIDATION_ERROR', message: 'channel, event_type, recipient and content are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      'SELECT * FROM notifications_log WHERE idempotency_key = $1',
      [idempotencyKey]
    );
    if (existing.rows.length) {
      await client.query('COMMIT');
      return res.status(200).json(existing.rows[0]);
    }

    const inserted = await client.query(
      `INSERT INTO notifications_log (order_id, customer_id, event_type, channel, recipient, content, status, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, $6, 'SENT', $7)
       RETURNING *`,
      [order_id || null, customer_id || null, event_type, channel, recipient, content, idempotencyKey]
    );
    await client.query('COMMIT');
    notificationsSentTotal.inc();
    return res.status(201).json(inserted.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    return next(error);
  } finally {
    client.release();
  }
});

router.get('/', async (req, res, next) => {
  const { page, limit, offset } = parsePagination(req.query);
  const params = [];
  const filters = [];

  if (req.query.event_type) {
    params.push(req.query.event_type);
    filters.push(`event_type = $${params.length}`);
  }
  if (req.query.channel) {
    params.push(req.query.channel);
    filters.push(`channel = $${params.length}`);
  }
  if (req.query.status) {
    params.push(req.query.status);
    filters.push(`status = $${params.length}`);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  try {
    const countQuery = `SELECT COUNT(*)::INT AS total FROM notifications_log ${whereClause}`;
    const dataQuery = `
      SELECT notification_id, event_type, channel, recipient, status, created_at
      FROM notifications_log
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const totalResult = await pool.query(countQuery, params);
    const dataResult = await pool.query(dataQuery, [...params, limit, offset]);
    return res.json({ page, limit, total: totalResult.rows[0].total, items: dataResult.rows });
  } catch (error) {
    return next(error);
  }
});

router.post('/events', async (req, res, next) => {
  const { event_type, order_id, customer_id, customer_email, customer_phone } = req.body;
  if (!event_type || !order_id) {
    return next({ status: 400, code: 'VALIDATION_ERROR', message: 'event_type and order_id are required' });
  }

  const channels = [];
  if (customer_email) {
    channels.push({ channel: 'EMAIL', recipient: customer_email });
  }
  if (customer_phone) {
    channels.push({ channel: 'SMS', recipient: customer_phone });
  }
  if (!channels.length) {
    channels.push({ channel: 'EMAIL', recipient: 'unknown@example.com' });
  }

  try {
    for (const target of channels) {
      await pool.query(
        `INSERT INTO notifications_log (order_id, customer_id, event_type, channel, recipient, content, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'SENT')`,
        [order_id, customer_id || null, event_type, target.channel, target.recipient, `${event_type} for order ${order_id}`]
      );
      notificationsSentTotal.inc();
    }
    return res.status(202).json({ accepted: true, channels: channels.length });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;