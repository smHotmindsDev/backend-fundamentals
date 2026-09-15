ALTER TABLE loans
    ADD COLUMN IF NOT EXISTS idempotency_key uuid