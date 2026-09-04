CREATE UNIQUE INDEX uidx_borrowed_book_copy
    ON loans(copy_id)
    WHERE returned_at IS NULL