-- All books by a given author, newest first. (basic JOIN + ORDER BY)
-- Plan: Index Scan using authors_pkey returns 1 author, Seq Scan reads all of books and keeps 10 rows by the same author filter, Nested Loop joins them, Sort orders by published_at DESC.
SELECT books.title, authors.first_name, authors.last_name, books.published_at
FROM books
JOIN authors ON books.author=authors.author_id
WHERE authors.author_id='726a9eb5-66da-4fdf-bf91-2c6c0d558276'
ORDER BY books.published_at DESC;