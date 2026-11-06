-- Assign a book_copies row to every loan of that book.
-- Open loans get distinct copies (at most total_copies are open after seed capping).
-- Returned loans round-robin across the book's copies.
WITH numbered_copies AS (
    SELECT
        copy_id,
        book_id,
        row_number() OVER (PARTITION BY book_id ORDER BY copy_id) AS copy_n,
        COUNT(*) OVER (PARTITION BY book_id) AS n_copies
    FROM book_copies
),
ranked_loans AS (
    SELECT
        loan_id,
        book,
        returned_at IS NULL AS is_open,
        row_number() OVER (
            PARTITION BY book, (returned_at IS NULL)
            ORDER BY borrowed_at, loan_id
        ) AS rn
    FROM loans
    WHERE copy_id IS NULL
)
UPDATE loans l
SET copy_id = nc.copy_id
FROM ranked_loans rl
JOIN numbered_copies nc
  ON nc.book_id = rl.book
 AND nc.n_copies > 0
 AND nc.copy_n = CASE
     WHEN rl.is_open THEN rl.rn
     ELSE ((rl.rn - 1) % nc.n_copies) + 1
 END
WHERE l.loan_id = rl.loan_id
  AND l.copy_id IS NULL;
