-- Pre-0023 rows have no client key; each gets a unique value so NOT NULL can be applied.
UPDATE loans
SET idempotency_key = gen_random_uuid()
WHERE idempotency_key IS NULL;

ALTER TABLE loans
    ALTER COLUMN idempotency_key SET NOT NULL;

CREATE UNIQUE INDEX uidx_loans_idempotency_key
    ON loans(idempotency_key);
