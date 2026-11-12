-- Authors who have never been borrowed. (LEFT JOIN … IS NULL vs NOT EXISTS — write both, compare plans)
-- Compare: both queries get the same plan and cost (1981.50..29436.51, 200 rows, ~180 ms); LEFT JOIN … IS NULL becomes an Anti Join only because IS NULL checks books.author from the join condition.

-- Plan: Seq Scan on loans probes a hash of books in a Hash Join, giving the author of each of the 500,016 loans; Hash Right Anti Join probes a hash of authors with those rows and returns the 200 authors that never got a match.
SELECT authors.first_name, authors.last_name
FROM authors
         LEFT JOIN (books JOIN loans ON loans.book = books.book_id)
                   ON books.author = authors.author_id
WHERE books.author IS NULL;

-- Plan: same as the LEFT JOIN version: Hash Join of loans and books, then Hash Right Anti Join with a hash of authors returns the 200 authors that never got a match.
SELECT authors.first_name, authors.last_name
FROM authors
WHERE NOT EXISTS (
    SELECT 1
    FROM books AS b2
             JOIN loans ON loans.book = b2.book_id
    WHERE b2.author = authors.author_id
);