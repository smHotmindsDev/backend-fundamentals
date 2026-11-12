-- For each member: their most recent loan. (the classic top-1-per-group — try DISTINCT ON, then a window function ROW_NUMBER(), compare)
-- Compare: both plans share the two Hash Joins and the Sort (cost 88444.85..89694.88, external merge, ~420–450 ms), and both read all 500,016 sorted rows. The only difference is the top node: DISTINCT ON finishes with Unique (cost ..90944.92; estimate 10,000, actual 9,500); ROW_NUMBER() finishes with WindowAgg and a Filter (cost ..104695.33; Filter estimates 2,500, actual 9,500). WindowAgg's Run Condition (row_number() <= 1) limits what it passes upward to the first row of each member_id (9,500); it does not change how many rows it reads from Sort.

-- Plan: Seq Scan on loans probes a hash of members in a Hash Join, then that result probes a hash of books in a second Hash Join (500,016 loan rows); Sort orders by member_id, borrowed_at DESC (external merge); Unique keeps the first row of each member_id, the latest loan, and returns 9,500 members.
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

-- Plan: same two Hash Joins and the same Sort as DISTINCT ON (Sort still returns 500,016 rows); WindowAgg reads all of them and assigns ROW_NUMBER(); its Run Condition (row_number() <= 1) limits the rows passed upward to the first of each member_id (9,500); Subquery Scan Filter keeps rn = 1.
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

