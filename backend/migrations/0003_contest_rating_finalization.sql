-- Make contest rating finalization idempotent across retries and workers.
ALTER TABLE offline_contests
    ADD COLUMN IF NOT EXISTS ratings_finalized_at TIMESTAMPTZ;
