DROP INDEX idx_loans_member_returned;
CREATE INDEX idx_loans_returned_member ON loans(returned_at, member);