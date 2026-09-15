-- Not for FK integrity (Postgres does not index FK columns automatically),
-- but for the availability lookup: copies of one book minus their open loans.
CREATE INDEX idx_book_copies_book_id
    ON book_copies(book_id);
