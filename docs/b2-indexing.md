# B2. Indexing Lab

## Task

1. Run drill #2 on the 500k-loan table without indexes. Note the time and the seq scan in the plan.
2. Add the right index(es). Note again.
3. Write the before/after.
4. Deliberately add a useless index and show the planner ignoring it — indexes aren't magic dust.
5. Composite index column order: demonstrate when `(member_id, returned_at)` works and `(returned_at, member_id)` doesn't for a given query.

**Drill #2 query:**

```sql
SELECT members.first_name, members.last_name, COUNT(*) AS overdue_counts
FROM members
JOIN loans ON loans.member = members.member_id
JOIN books ON loans.book = books.book_id
WHERE CURRENT_DATE > loans.due_at AND loans.returned_at IS NULL
GROUP BY members.member_id
ORDER BY overdue_counts DESC;
```

---

## Results summary

| Stage | Execution Time |
|---|---|
| No indexes | ~65.7 ms |
| Non-covering index `(member, due_at)` | ~224.7 ms (**worse**) |
| Covering index `(member, due_at, book)` | ~38.9 ms |

### 1. Without indexes

```
Planning Time: 0.322 ms
Execution Time: 65.695 ms
```

Plan showed a `Parallel Seq Scan on loans` with `Filter: ((returned_at IS NULL) AND (CURRENT_DATE > due_at))` and a large `Rows Removed by Filter`. To find which condition was actually selective, I measured each predicate separately against the full 500,000-row table:

```sql
SELECT COUNT(*) FROM loans WHERE returned_at IS NULL;        -- 33,600  (6.7%)
SELECT COUNT(*) FROM loans WHERE CURRENT_DATE > due_at;      -- 488,889 (97.8%)
```

`returned_at IS NULL` is highly selective; `due_at` alone filters out almost nothing (loans in the seed data are backdated over years, so nearly every due date is already in the past). This pointed to `returned_at` as the right column to index, ideally as a **partial index** (`WHERE returned_at IS NULL`) so the index only covers the ~6.7% of "live" rows.

### 2. First attempt — non-covering partial index

```sql
CREATE INDEX idx_member_with_unreturned_loans
ON loans(member, due_at)
WHERE returned_at IS NULL;
```

```
Planning Time: 1.316 ms
Execution Time: 224.653 ms
```

Execution time **increased** relative to no index at all. The plan showed `Bitmap Heap Scan on loans` with `Heap Blocks: exact=5556`, using only a single worker instead of the 3 parallel workers from the seq-scan plan. The index correctly narrowed `loans` down to the ~33,600 unreturned rows, but since the index didn't include `book`, Postgres still had to visit the heap (the actual table) for every one of those rows to fetch `book` for the join with `books`. The random-access heap lookups plus the loss of parallelism outweighed the benefit of the smaller row set.

### 3. Covering index

Added `book` to the index so all columns needed by the query (`member` for the join, `due_at` for the filter, `book` for the second join) live in the index itself:

```sql
CREATE INDEX idx_member_due_book_unreturned
ON loans(member, due_at, book)
WHERE returned_at IS NULL;
```

```
Planning Time: 1.208 ms
Execution Time: 38.934 ms
```

```
Index Only Scan using idx_member_due_book_unreturned on loans
  Index Cond: (due_at < CURRENT_DATE)
  Heap Fetches: 0
```

`Bitmap Heap Scan` became `Index Only Scan`, and `Heap Fetches: 0` confirms Postgres never touched the table itself — every column the query needed from `loans` was already in the index. This is the fastest of the three runs, roughly **1.7x faster than no index** and **~6x faster** than the non-covering attempt.

**Lesson:** a partial index that matches the filter predicate isn't enough on its own — if it doesn't cover every column the query needs, the heap lookups (and lost parallelism) can make it *slower* than a plain sequential scan.

---

## 4. Useless index — planner ignoring it

With both `idx_member_with_unreturned_loans` (`member, due_at`) and `idx_member_due_book_unreturned` (`member, due_at, book`) present at the same time, re-running drill #2 shows the plan using only:

```
Index Only Scan using idx_member_due_book_unreturned on loans
```

`idx_member_with_unreturned_loans` never appears in the plan. This is because it is a strict prefix/subset of the newer index — same leading columns (`member, due_at`), same `WHERE` predicate, but the newer index also covers `book` and supports an `Index Only Scan`. Any query the older index could serve, the newer one serves at least as cheaply, so the planner never has a reason to pick it. It still occupies disk space and adds write overhead on every `INSERT`/`UPDATE`/`DELETE` to `loans`, without ever being read:

```sql
SELECT indexname, pg_size_pretty(pg_relation_size(indexname::regclass)) AS size
FROM pg_indexes
WHERE tablename = 'loans';
```

**Lesson:** an index doesn't have to be irrelevant to the query to be useless — it can simply be dominated by a better index on the same leading columns.

---

## 5. Composite index column order

**Summary:** column order in a composite index only matters when at least one of the two conditions is a genuine *range* (not an equality/`IS NULL` check). With two equality-style conditions, order made no measurable difference. With one equality condition (`member = X`) and one range condition (`returned_at > X`), the order changed the planner's cost estimate by roughly 190x, because the leading column determines how much of the index tree Postgres has to scan before the second condition can be checked.

Since drill #2's own `WHERE` clause doesn't have an equality condition on `member`, a separate test query was used to isolate the effect of column order on the same two columns (`member`, `returned_at`):

```sql
EXPLAIN ANALYZE
SELECT loans.loan_id
FROM loans
WHERE loans.member = '9bc7fe44-86da-47bc-be67-e4e61513cb88'
  AND loans.returned_at IS NULL;
```

### Round 1 — `returned_at IS NULL` (equality-style condition)

`(member, returned_at)`:
```
Bitmap Index Scan on idx_loans_member_returned
  Index Cond: ((member = '9bc7fe44...'::uuid) AND (returned_at IS NULL))
Execution Time: 1.041 ms
```

`(returned_at, member)`:
```
Index Scan using idx_loans_returned_member on loans
  Index Cond: ((returned_at IS NULL) AND (member = '9bc7fe44...'::uuid))
Execution Time: 0.663 ms
```

Both orders produced an `Index Cond` covering both columns, and neither was clearly worse. This initially looked like it disproved the "leading column matters" rule — but the reason is that `IS NULL` is itself an equality-style lookup, not a range. When *both* conditions are point lookups, a B-tree can combine them efficiently regardless of which one leads, since both narrow the search to a single point/small set rather than a scan range.

### Round 2 — a real range condition on `returned_at`

To see the rule actually apply, the condition on `returned_at` was changed to a genuine range (`< '2026-08-01'`, later `> '2026-08-01'` — a date that splits the "returned" rows into a smaller, more selective slice):

```sql
EXPLAIN ANALYZE
SELECT loans.loan_id, loans.member, loans.returned_at
FROM loans
WHERE loans.member = '9bc7fe44-86da-47bc-be67-e4e61513cb88'
  AND loans.returned_at > '2026-08-01';
```

`(member, returned_at)` — `member` leads:
```
Bitmap Index Scan on idx_loans_member_returned
  Index Cond: ((member = '9bc7fe44...'::uuid) AND (returned_at > '2026-08-01'::date))
  cost=0.00..4.45
Execution Time: 0.139 ms
```

`(returned_at, member)` — `returned_at` leads:
```
Index Scan using idx_loans_returned_member on loans
  Index Cond: ((returned_at > '2026-08-01'::date) AND (member = '9bc7fe44...'::uuid))
  cost=0.42..841.70
Execution Time: 1.956 ms
```

Both plans show an `Index Cond` that textually mentions both columns — but the estimated **cost** differs by close to 190x (`4.45` vs `841.70`). With `member` leading, Postgres narrows directly to the small subtree belonging to that one member and only then checks the date range inside it. With `returned_at` leading, Postgres has to scan the whole range of index entries matching `returned_at > date` — which includes every member who returned a book after that date — and only "attaches" the `member` check to each entry it walks past, rather than using it to shrink the scan itself.

For reference, a companion run with `returned_at < '2026-08-01'` (a much less selective range — ~93% of rows) made the `(returned_at, member)` index so unattractive that the planner skipped it entirely and fell back to a `Parallel Seq Scan`:

```
Parallel Seq Scan on loans
  Filter: ((returned_at < '2026-08-01'::date) AND (member = '9bc7fe44...'::uuid))
  Rows Removed by Filter: 166657
Execution Time: 21.962 ms
```

while `(member, returned_at)` with the same predicate still used `Bitmap Index Scan` at negligible cost.

**Lesson:** the "equality columns before range columns" rule is really about which column determines how much of the index the planner has to walk. Two equality-style conditions (including `IS NULL`) can be combined efficiently in either order. Once one condition is a genuine range, putting it first forces a wide scan that the second condition can only filter after the fact — and if that leading range condition also happens to be unselective, the planner may abandon the index altogether.