# API contracts

Behaviour the API must keep. Test-plan rows are derived from these contracts — not the other way around.

Other endpoints (`GET /books`, `POST /loans`, `POST /loans/:id/return`) get their own sections once designed the same way.

## `GET /reports/top-books`

### What it does for the client

Returns the 10 most borrowed books in the last 90 days, **inclusive** of the 90-day boundary.

Returned loans still count. The query does **not** filter on `loans.returned_at`. Popularity is the fact of a borrow, not current possession.

### Method

`GET` — no database writes.

### Request

| Part | Value |
| --- | --- |
| Path | `/reports/top-books` |
| Auth | `Authorization: Bearer <key>` |
| Query / body | none |

### Success

| | |
| --- | --- |
| Status | `200` |
| Body | JSON array, **at most** 10 elements (fewer than 10 is valid; empty array is valid) |

Each element:

| Field | Type | Notes |
| --- | --- | --- |
| `book_id` | uuid | Postgres column `books.book_id` |
| `title` | string | |
| `borrow_count` | integer | `COUNT(loans.loan_id)::int` in SQL so `pg` returns a number, not a string |

Order is deterministic: `borrow_count` descending, then `book_id` ascending.

Empty database (or no matching rows after grouping) → `200` and `[]`. The query succeeded; there was nothing to rank.

### Errors

| Status | When |
| --- | --- |
| `401` | `Authorization` header missing |
| `401` | header present, value does not match the configured key (including a well-formed `Bearer` with the wrong secret) |
| `429` | key is valid, per-key request limit exhausted |

There is no `403`: a single shared API key has no “authenticated but not allowed” case.

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

---

### Test fixture (not `seed.js`)

Truncate the test database, then insert relative to `CURRENT_DATE` so the 90-day window does not drift.

Deterministic ids — no `gen_random_uuid()` in fixtures (example: `00000000-0000-0000-0000-000000000001`).

One author. Loans must satisfy FKs (`author`, `member`, `copy_id`) and the partial unique index on open loans (`copy_id` where `returned_at IS NULL`). Returned loans are enough for this report; many members are not required if every loan is returned.

**Inserted loan counts vs API counts are different.** Column *Inserted loans* is how many `loans` rows you write. The API returns the count **inside the 90-day window**. Steam House (42 loans at 91 days) and The Mysterious Island (100 at 100 days) therefore appear as `0`.

| Title | Inserted loans | Loan `borrowed_at` | `book_id` | `available_copies` | `total_copies` | `published_at` |
| --- | --- | --- | --- | --- | --- | --- |
| Twenty Thousand Leagues | 50 | `CURRENT_DATE - INTERVAL '30 day'` | `00000000-0000-0000-0000-000000000000` | 25 | 50 | 1905-01-01 |
| Around the World in 80 Days | 49 | `CURRENT_DATE - INTERVAL '30 day'` | `00000000-0000-0000-0000-000000000001` | 25 | 49 | 1905-01-01 |
| Journey to the Centre of the Earth | 48 | `CURRENT_DATE - INTERVAL '30 day'` | `00000000-0000-0000-0000-000000000002` | 25 | 48 | 1905-01-01 |
| From the Earth to the Moon | 47 | `CURRENT_DATE - INTERVAL '30 day'` | `00000000-0000-0000-0000-000000000003` | 25 | 47 | 1905-01-01 |
| Michael Strogoff | 46 | `CURRENT_DATE - INTERVAL '30 day'` | `00000000-0000-0000-0000-000000000004` | 25 | 46 | 1905-01-01 |
| Five Weeks in a Balloon | 45 | `CURRENT_DATE - INTERVAL '89 day'` | `00000000-0000-0000-0000-000000000005` | 25 | 45 | 1905-01-01 |
| In Search of the Castaways | 44 | `CURRENT_DATE - INTERVAL '90 day'` | `00000000-0000-0000-0000-000000000006` | 25 | 44 | 1905-01-01 |
| Robur the Conqueror | 44 | `CURRENT_DATE - INTERVAL '30 day'` | `00000000-0000-0000-0000-000000000007` | 25 | 44 | 1905-01-01 |
| The Steam House | 42 | `CURRENT_DATE - INTERVAL '91 day'` | `00000000-0000-0000-0000-000000000008` | 25 | 42 | 1905-01-01 |
| Paris in the Twentieth Century | 0 | — | `00000000-0000-0000-0000-000000000009` | 10 | 10 | 1905-01-01 |
| Around the Moon | 0 | — | `00000000-0000-0000-0000-000000000010` | 10 | 10 | 1905-01-01 |
| The Green Ray | 0 | — | `00000000-0000-0000-0000-000000000011` | 10 | 10 | 1905-01-01 |
| The Mysterious Island | 100 | `CURRENT_DATE - INTERVAL '100 day'` | `00000000-0000-0000-0000-000000000012` | 100 | 100 | 1905-01-01 |

Author FK on every book: `00000000-0000-0000-0000-000000000000`.

What this fixture is built to break if the query is wrong:

- 90-day inclusive boundary: Castaways @ 90d counts; Steam House @ 91d does not
- tie-break: two books with 44, ordered by `book_id`
- out-of-window volume: Mysterious Island’s 100 loans do not rank it
- zero-borrow books can fill remaining slots when fewer than 10 books have a window count > 0

### Expected response (`200`)

Computed from the fixture **after** the window filter. Not a copy of *Inserted loans*.

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
