ALTER TABLE loans
    ALTER COLUMN copy_id SET NOT NULL,
    ADD CONSTRAINT fk_book_copy_id
        FOREIGN KEY (copy_id)
            REFERENCES book_copies(copy_id);