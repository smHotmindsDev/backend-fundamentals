-- Top 10 most borrowed books of the last 90 days. (GROUP BY + COUNT + LIMIT)
-- Plan: books are Seq Scanned and hashed for Hash Join; Parallel Seq Scan reads loans and Filter keeps borrowed_at > (CURRENT_DATE - '90 days'::interval); Partial HashAggregate counts loans per book_id; Gather collects these partial counts; Finalize HashAggregate sums them into one row per book; Sort books by that count DESC; Limit first 10 books
EXPLAIN
SELECT books.title, COUNT(*) as borrowed_counts
FROM books
JOIN loans ON loans.book=books.book_id
WHERE loans.borrowed_at > CURRENT_DATE - INTERVAL '90 day'
GROUP BY books.book_id
ORDER BY borrowed_counts DESC, books.title ASC
LIMIT 10;