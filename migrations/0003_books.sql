CREATE TABLE IF NOT EXISTS books (
    book_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    author uuid NOT NULL,
    FOREIGN KEY (author) REFERENCES authors(author_id),
    available_copies int NOT NULL,
    total_copies int NOT NULL,
    CHECK (available_copies >= 0),
    CHECK (total_copies >= available_copies)
)