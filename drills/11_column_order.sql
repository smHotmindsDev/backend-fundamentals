-- Composite index column order:
-- demonstrate when (member_id, returned_at) works and
-- (returned_at, member_id) doesn't for a given query.

-- Plan: Index Scan using idx_loans_member_returned; Index Cond ((member = '9bc7fe44-86da-47bc-be67-e4e61513cb88') AND (returned_at > '2026-08-01')); estimate 3 rows, actual 0.
EXPLAIN ANALYZE
SELECT loans.loan_id, loans.member, loans.returned_at
FROM loans
WHERE loans.member = '9bc7fe44-86da-47bc-be67-e4e61513cb88'
  AND loans.returned_at > '2026-08-01'
;