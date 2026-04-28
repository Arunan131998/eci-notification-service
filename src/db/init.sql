CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS notifications_log (
  notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id VARCHAR(64),
  customer_id VARCHAR(64),
  event_type VARCHAR(64) NOT NULL,
  channel VARCHAR(20) NOT NULL,
  recipient VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'SENT',
  idempotency_key VARCHAR(120) UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_order_id ON notifications_log(order_id);
CREATE INDEX IF NOT EXISTS idx_notifications_event_type ON notifications_log(event_type);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications_log(status);
