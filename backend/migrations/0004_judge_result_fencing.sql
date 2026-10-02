-- Persist accepted node results with the authoritative attempt transition.
ALTER TABLE judge_jobs
    ADD COLUMN IF NOT EXISTS result_payload JSON;
