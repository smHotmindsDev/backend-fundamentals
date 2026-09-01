CREATE TABLE loans (
    loan_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    member uuid NOT NULL,
    FOREIGN KEY (member) REFERENCES members(member_id),
    book uuid NOT NULL,
    FOREIGN KEY (book) REFERENCES books(book_id),
    borrowed_at date NOT NULL,
    due_at date NOT NULL,
    returned_at date NULL,
    CHECK ( due_at >  borrowed_at)
)