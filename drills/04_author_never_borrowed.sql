-- Authors who have never been borrowed. (LEFT JOIN … IS NULL vs NOT EXISTS — write both, compare plans)
EXPLAIN ANALYZE
SELECT authors.first_name, authors.last_name, COUNT(*) AS never_borrowed_counts
FROM authors
JOIN books ON books.author=authors.author_id
LEFT JOIN loans ON loans.book=books.book_id
WHERE loans.borrowed_at IS NULL
GROUP BY authors.author_id;

EXPLAIN ANALYZE
SELECT authors.first_name, authors.last_name
FROM authors
WHERE NOT EXISTS (
    SELECT 1
    FROM books AS b2
    JOIN loans ON loans.book = b2.book_id
    WHERE b2.author = authors.author_id
);