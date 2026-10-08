-- Each member's currently borrowed count, including zeroes.
SELECT members.first_name, members.last_name, COUNT(loans.borrowed_at) AS borrowed_counts
FROM members
LEFT JOIN loans ON loans.member=members.member_id AND loans.returned_at IS NULL
GROUP BY members.member_id
ORDER BY  borrowed_counts;


