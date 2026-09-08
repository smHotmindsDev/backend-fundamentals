-- Full-text-ish search:
-- books by title fragment, case-insensitive
-- — then discuss why LIKE '%x%' can't use a normal index.
SELECT *
FROM books
WHERE books.title ILIKE '%b%';
