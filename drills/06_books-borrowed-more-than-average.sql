-- Books borrowed more than average. (subquery)
-- Plan: InitPlan 1 runs the subquery once: Seq Scan on loans probes a hash of books in a Hash Join, HashAggregate counts loans per book_id, Aggregate takes AVG of those counts and returns $0; the main query repeats the same Hash Join and HashAggregate per book_id, and its Filter (the HAVING) keeps groups where count > $0.
SELECT books.book_id, COUNT(loans.loan_id) AS loan_count
FROM books
         JOIN loans ON loans.book = books.book_id
GROUP BY books.book_id
HAVING COUNT(loans.loan_id) > (
    SELECT AVG(borrowed_count)
    FROM (
             SELECT COUNT(loans.loan_id) AS borrowed_count
             FROM books
                      JOIN loans ON loans.book = books.book_id
             GROUP BY books.book_id
         ) AS loans_counter
);