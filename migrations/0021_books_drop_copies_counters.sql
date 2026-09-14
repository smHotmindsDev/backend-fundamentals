-- Availability is derived from book_copies minus open loans, never stored.
-- Both CHECK constraints reference only these columns and are dropped with them.
ALTER TABLE books
    DROP COLUMN IF EXISTS available_copies,
    DROP COLUMN IF EXISTS total_copies;
