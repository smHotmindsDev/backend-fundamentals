CREATE INDEX idx_member_with_unreturned_loans
ON loans(member, due_at)
WHERE loans.returned_at IS NULL;