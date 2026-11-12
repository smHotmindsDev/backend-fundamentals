-- Each member's currently borrowed count, including zeroes.
-- Plan: partial index uidx_borrowed_book_copy (WHERE returned_at IS NULL) matches the IS NULL condition, so Bitmap Index Scan + Bitmap Heap Scan read only unreturned loans; members are Seq Scanned and hashed for Hash Right Join with unreturned loans; HashAggregate computes GROUP BY members.member_id and counts borrowed_at per member; Sort orders by that count ASC.
SELECT members.first_name, members.last_name, COUNT(loans.borrowed_at) AS borrowed_counts
FROM members
    LEFT JOIN loans
        ON loans.member=members.member_id AND loans.returned_at IS NULL
GROUP BY members.member_id
ORDER BY  borrowed_counts;


