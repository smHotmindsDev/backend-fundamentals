-- check: is any copy_id assigned to two active loans at once
SELECT copy_id, COUNT(*)
FROM loans
WHERE returned_at IS NULL
GROUP BY copy_id
HAVING COUNT(*) > 1;