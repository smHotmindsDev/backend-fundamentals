-- Per-month loan counts for the last year, months with zero included. (generate_series — a taste of real reporting SQL)
-- Plan: ProjectSet runs generate_series in the SELECT list and Result casts each value to date (planner guesses 1000 months, real 12); the join condition is a range, not =, so Nested Loop Left Join checks every month against all 500,015 loans kept in Materialize after one Seq Scan, and months with no match stay with NULL; HashAggregate counts loans per month; Sort orders by month.
SELECT month.monthly_date AS month_start,
       COUNT(loans.loan_id) AS loans_count
FROM (
    SELECT generate_series(
        '2026-01-01'::DATE,
        '2026-12-01'::DATE,
        '1 month'::INTERVAL)::DATE AS monthly_date
    )
    AS month
LEFT JOIN loans
    ON loans.borrowed_at >= month.monthly_date
           AND loans.borrowed_at < month.monthly_date + INTERVAL '1 month'
GROUP BY month.monthly_date
ORDER BY month.monthly_date
;

