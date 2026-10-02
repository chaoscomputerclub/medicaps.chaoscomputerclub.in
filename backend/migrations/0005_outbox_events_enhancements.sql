-- Migration: 0005_outbox_events_enhancements.sql
-- Enforces transactional outbox columns and performance indexes for cluster-wide reliability.

CREATE TABLE IF NOT EXISTS outbox_events (
    id VARCHAR(36) PRIMARY KEY,
    queue_name VARCHAR(40) NOT NULL DEFAULT 'realtime',
    event_type VARCHAR(80) NOT NULL,
    aggregate_id VARCHAR(100),
    payload JSON NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'normal',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    error_message TEXT
);

ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS queue_name VARCHAR(40) NOT NULL DEFAULT 'realtime';
ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'normal';
ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS error_message TEXT;

CREATE INDEX IF NOT EXISTS ix_outbox_events_status ON outbox_events(status);
CREATE INDEX IF NOT EXISTS ix_outbox_events_created_at ON outbox_events(created_at);
CREATE INDEX IF NOT EXISTS ix_outbox_events_queue_status ON outbox_events(queue_name, status);
