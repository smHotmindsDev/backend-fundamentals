CREATE INDEX idx_member_due_book_unreturned
    ON loans(member, due_at, book)
    WHERE loans.returned_at IS NULL;