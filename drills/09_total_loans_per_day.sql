-- Running total of loans per day over a month. (window function SUM OVER)
SELECT
    day,
    loans_count,
    SUM(loans_count) OVER (ORDER BY day) AS running_total
FROM (
         SELECT month.daily_date AS day,
                COUNT(loans.loan_id) AS loans_count
         FROM (
                  SELECT generate_series(
                                 '2026-01-01'::DATE,
                                 '2026-01-31'::DATE,
                                 '1 day'::INTERVAL)::DATE AS daily_date
              )
                  AS month
                  LEFT JOIN loans
                            ON loans.borrowed_at >= month.daily_date
                                AND loans.borrowed_at < month.daily_date + INTERVAL '1 day'
         GROUP BY month.daily_date
         ORDER BY month.daily_date
     ) AS daily
ORDER BY day
;

