DROP INDEX idx_loans_returned_member;
CREATE INDEX idx_loans_member_returned ON loans(member, returned_at);