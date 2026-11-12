-- Full-text-ish search:
-- books by title fragment, case-insensitive
-- — then discuss why LIKE '%x%' can't use a normal index.
-- Plan: Seq Scan reads table "books" and Filter keeps title ~~* '%b%'::text;
SELECT *
FROM books
WHERE books.title ILIKE '%b%';
