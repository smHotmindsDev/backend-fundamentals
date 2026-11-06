-- Top 10 most borrowed books of the last 90 days. (GROUP BY + COUNT + LIMIT)
SELECT books.title, COUNT(*) as borrowed_counts
FROM books
JOIN loans ON loans.book=books.book_id
WHERE loans.borrowed_at > CURRENT_DATE - INTERVAL '90 day'
GROUP BY books.book_id
ORDER BY borrowed_counts DESC, books.title ASC
LIMIT 10;