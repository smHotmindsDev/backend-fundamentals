-- Books borrowed more than average. (subquery)
SELECT books.book_id, COUNT(loans.loan_id) as loan_count
FROM books
JOIN loans ON book=book_id
GROUP BY books.book_id
HAVING COUNT(loans.loan_id) > (
    SELECT AVG(borrowed_count) AS final_average
    FROM (
        SELECT COUNT(loans.borrowed_at) AS borrowed_count
        FROM books
        JOIN loans ON book=book_id
        GROUP BY books.book_id
    ) AS loans_counter
);
