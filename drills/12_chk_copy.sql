-- check: is any copy_id assigned to two active loans at once
-- Plan: partial unique index uidx_borrowed_book_copy (WHERE returned_at IS NULL) matches the IS NULL condition, so Index Only Scan reads the unreturned loans in copy_id order; GroupAggregate groups by copy_id on that order and Filter (count(*) > 1) removes all 33,615 groups (estimate 10,845, actual 0).
SELECT copy_id, COUNT(*)
FROM loans
WHERE returned_at IS NULL
GROUP BY copy_id
HAVING COUNT(*) > 1;