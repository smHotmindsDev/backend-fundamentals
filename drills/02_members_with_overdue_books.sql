-- Members who currently hold overdue books. (JOIN + WHERE on nullable column + date logic)
EXPLAIN ANALYSE
SELECT members.first_name, members.last_name, COUNT(*) AS overdue_counts
FROM members
JOIN loans ON loans.member=members.member_id
JOIN books ON loans.book=books.book_id
WHERE CURRENT_DATE>loans.due_at AND loans.returned_at IS NULL
GROUP BY members.member_id
ORDER BY  overdue_counts DESC;