-- For each member: their most recent loan. (the classic top-1-per-group — try DISTINCT ON, then a window function ROW_NUMBER(), compare)
EXPLAIN ANALYSE
SELECT
    DISTINCT ON (members.member_id) members.member_id,
                                    members.first_name,
                                    members.last_name,
                                    books.title,
                                    loans.borrowed_at
FROM members
JOIN loans on members.member_id = loans.member
JOIN books on loans.book=books.book_id
ORDER BY
    members.member_id, loans.borrowed_at DESC
;

EXPLAIN ANALYSE
WITH MostRecentLoan AS (
    SELECT
        members.member_id,
        members.first_name,
        members.last_name,
        books.title,
        loans.borrowed_at,
        ROW_NUMBER() OVER (PARTITION BY members.member_id ORDER BY loans.borrowed_at DESC) AS rn
    FROM members
    JOIN loans on members.member_id = loans.member
    JOIN books on loans.book=books.book_id
)
SELECT *
FROM MostRecentLoan
WHERE rn = 1
;

