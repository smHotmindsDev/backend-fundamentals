-- Members who currently hold overdue books. (JOIN + WHERE on nullable column + date logic)
-- Plan: partial index uidx_borrowed_book_copy (WHERE returned_at IS NULL) matches the IS NULL condition, so Bitmap Index Scan + Bitmap Heap Scan read only unreturned loans and Filter keeps CURRENT_DATE > due_at; members and books are Seq Scanned and hashed for two Hash Joins; HashAggregate counts loans per member; Sort orders by that count DESC.
SELECT members.first_name, members.last_name, COUNT(*) AS overdue_counts
FROM members
         JOIN loans ON loans.member = members.member_id
         JOIN books ON loans.book = books.book_id
WHERE CURRENT_DATE > loans.due_at AND loans.returned_at IS NULL
GROUP BY members.member_id
ORDER BY overdue_counts DESC;