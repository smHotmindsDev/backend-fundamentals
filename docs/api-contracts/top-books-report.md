## `GET /reports/top-books`

### What it does for the client

Returns the 10 most borrowed books in the last 90 days, **inclusive** of the 90-day boundary.

Returned loans still count. The query does **not** filter on `loans.returned_at`. Popularity is the fact of a borrow, not current possession.

### Method

`GET` — no database writes.

### Request
- **Path** — `/reports/top-books`
- **Path parameters:** none
- **Headers:**
- `X-API-Key: abcdef12345`
- **Query / body** — none

`X-API-Key: abcdef12345` is a placeholder.
Authorization is described in a separate document.

### Success

- **Status** — `200`
- **Body** — JSON array, **at most** 10 elements (fewer than 10 is valid; empty array is valid)

Each element:

- `book_id` — uuid — Postgres column `books.book_id`
- `title` — string
- `borrow_count` — integer — `COUNT(loans.loan_id)::int` in SQL so `pg` returns a number, not a string

Order is deterministic: `borrow_count` descending, then `book_id` ascending.

Empty database (or no matching rows after grouping) → `200` and `[]`. The query succeeded; there was nothing to rank.

### Errors
N/a

### Side effects

None.

### Limits

- Response size is a **fixed** cap of 10 rows. There is no page parameter.
- Response-time budget: **200 ms** on the full ~500k-loan dataset. That check is **not** part of the small-seed CI suite (plan analysis / local measurement on production-sized data). Functional tests use a tiny deterministic seed.

### Query

```sql
-- Top 10 most borrowed books of the last 90 days
SELECT books.book_id, books.title, COUNT(loans.loan_id)::int AS borrow_count
FROM books
LEFT JOIN loans
  ON loans.book = books.book_id
 AND loans.borrowed_at >= CURRENT_DATE - INTERVAL '90 day'
GROUP BY books.book_id
ORDER BY borrow_count DESC, books.book_id ASC
LIMIT 10;
```

Window: `>=` 90 days (a loan exactly 90 days ago **is** included). Books with zero borrows in the window can appear if fewer than 10 books have a positive count.

### Test fixture (not `../../seed.js`)

Truncate the test database, then insert relative to `CURRENT_DATE` so the 90-day window does not drift.

Deterministic ids — no `gen_random_uuid()` in fixtures (example: `00000000-0000-0000-0000-000000000001`).

One author. Loans must satisfy FKs (`author`, `member`, `copy_id`) and the partial unique index on open loans (`copy_id` where `returned_at IS NULL`). Returned loans are enough for this report; many members are not required if every loan is returned.

**One `book_copies` row per book is enough**, and every loan of that book points at it. Because each loan here is returned, the partial unique index does not apply, so any number of closed loans may share a single copy. This report never reads availability — copies exist only to satisfy the `copy_id` FK.

**Inserted loan counts vs API counts are different.** Column *inserted_loans* is how many `loans` rows you write. The API returns the count **inside the 90-day window**. Steam House (42 loans at 91 days) and The Mysterious Island (100 at 100 days) therefore appear as `0`.

`borrowed_at` is the interval passed to `CURRENT_DATE - INTERVAL '<n> day'`; `-` means no loans inserted.

```csv
title,inserted_loans,borrowed_at,book_id,published_at
Twenty Thousand Leagues,50,30 day,00000000-0000-0000-0000-000000000000,1905-01-01
Around the World in 80 Days,49,30 day,00000000-0000-0000-0000-000000000001,1905-01-01
Journey to the Centre of the Earth,48,30 day,00000000-0000-0000-0000-000000000002,1905-01-01
From the Earth to the Moon,47,30 day,00000000-0000-0000-0000-000000000003,1905-01-01
Michael Strogoff,46,30 day,00000000-0000-0000-0000-000000000004,1905-01-01
Five Weeks in a Balloon,45,89 day,00000000-0000-0000-0000-000000000005,1905-01-01
In Search of the Castaways,44,90 day,00000000-0000-0000-0000-000000000006,1905-01-01
Robur the Conqueror,44,30 day,00000000-0000-0000-0000-000000000007,1905-01-01
The Steam House,42,91 day,00000000-0000-0000-0000-000000000008,1905-01-01
Paris in the Twentieth Century,0,-,00000000-0000-0000-0000-000000000009,1905-01-01
Around the Moon,0,-,00000000-0000-0000-0000-000000000010,1905-01-01
The Green Ray,0,-,00000000-0000-0000-0000-000000000011,1905-01-01
The Mysterious Island,100,100 day,00000000-0000-0000-0000-000000000012,1905-01-01
```

Author FK on every book: `00000000-0000-0000-0000-000000000000`.

What this fixture is built to break if the query is wrong:

- 90-day inclusive boundary: Castaways @ 90d counts; Steam House @ 91d does not
- tie-break: two books with 44, ordered by `book_id`
- out-of-window volume: Mysterious Island’s 100 loans do not rank it
- zero-borrow books can fill remaining slots when fewer than 10 books have a window count > 0

### Expected response (`200`)

Computed from the fixture **after** the window filter. Not a copy of *inserted_loans*.

```json
[
  { "book_id": "00000000-0000-0000-0000-000000000000", "title": "Twenty Thousand Leagues", "borrow_count": 50 },
  { "book_id": "00000000-0000-0000-0000-000000000001", "title": "Around the World in 80 Days", "borrow_count": 49 },
  { "book_id": "00000000-0000-0000-0000-000000000002", "title": "Journey to the Centre of the Earth", "borrow_count": 48 },
  { "book_id": "00000000-0000-0000-0000-000000000003", "title": "From the Earth to the Moon", "borrow_count": 47 },
  { "book_id": "00000000-0000-0000-0000-000000000004", "title": "Michael Strogoff", "borrow_count": 46 },
  { "book_id": "00000000-0000-0000-0000-000000000005", "title": "Five Weeks in a Balloon", "borrow_count": 45 },
  { "book_id": "00000000-0000-0000-0000-000000000006", "title": "In Search of the Castaways", "borrow_count": 44 },
  { "book_id": "00000000-0000-0000-0000-000000000007", "title": "Robur the Conqueror", "borrow_count": 44 },
  { "book_id": "00000000-0000-0000-0000-000000000008", "title": "The Steam House", "borrow_count": 0 },
  { "book_id": "00000000-0000-0000-0000-000000000009", "title": "Paris in the Twentieth Century", "borrow_count": 0 }
]
```

Around the Moon, The Green Ray, and The Mysterious Island are not in the array (`LIMIT 10`; remaining zeros lose on `book_id`).
