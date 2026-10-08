CREATE INDEX idx_loans_member_returned
    ON loans(member, returned_at);