CREATE TABLE IF NOT EXISTS book_copies (
    copy_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id uuid NOT NULL,
    FOREIGN KEY (book_id) REFERENCES books(book_id)
)