# Test plan

What is tested at which level, and why.

One behaviour = one row. Fill before writing tests. Rows with empty Happy / Error wait on a contract in `docs/contracts.md`.

## Unit

Pure logic in isolation, no I/O. Fast (ms), many.

Here: overdue calculation, pagination math, rate-limiter logic, validation schemas.

| What | Why this level | Happy path | Error / edge |
| --- | --- | --- | --- |
| Per-key rate limiter | In-memory counter; no I/O | `k ≤ N` requests → allow | Request `N+1` → deny |
| Pagination math (`GET /books`) | Offset/limit arithmetic is pure | — | — |
| Overdue calculation | Date logic; freeze time, do not hit Postgres | — | — |
| Validation schemas (Zod) | Parses input in memory | — | — |

## Integration

Own code + real Postgres. Do not mock `pg`.

Here: every endpoint against a real test Postgres (Docker), repositories/queries, the borrow transaction.

Auth-lite is HTTP contract (status + header), not limiter arithmetic (that is unit) and not a full user journey (that is E2E). These rows do not require seeded books.

| What                                         | Why this level                                                      | Happy path                                                    | Error / edge                                                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Auth-lite: `Authorization` header            | HTTP status mapping; no SQL                                         | Valid `Authorization: Bearer <key>` → request is not rejected | Missing header → `401`; well-formed `Bearer` with the wrong secret → `401`; valid key, limit exhausted → `429` |
| `GET /reports/top-books` — empty database    | Empty ranking is a query result, not an `if`                        | `200` + `[]`                                                  | —                                                                                                              |
| `GET /reports/top-books` — ranked report     | Mocking `pg` cannot prove `COUNT`, the 90-day window, or `ORDER BY` | `200` + JSON below (window count, tie-break, zeros)           | —                                                                                                              |
| `GET /books?search=&page=` — pagination      | Real `LIMIT`/`OFFSET` against Postgres                              | —                                                             | —                                                                                                              |
| `POST /loans` — transactional borrow         | Real transaction, constraints, `409` on conflict                    | —                                                             | —                                                                                                              |
| `POST /loans` — double-borrow race           | Two parallel borrows of the last copy; exactly one succeeds         | —                                                             | —                                                                                                              |
| `POST /loans/:id/return` — idempotent return | Second return is `200` no-op; assert DB state                       | —                                                             | —                                                                                                              |


Response-time budget for `GET /reports/top-books` (200 ms on ~500k loans): **not** in this suite. Check the query plan / measure locally on the full dataset. Functional tests use the tiny seed below.

### Expected body for `GET /reports/top-books` (`200`)

Computed from the fixture in `docs/contracts.md` **after** `borrowed_at >= CURRENT_DATE - 90 days`. Inserted loans outside the window count as 0 (Steam House 42 @ 91d, Mysterious Island 100 @ 100d). Tie 44/44: Castaways `…0006` before Robur `…0007`. The two extra slots to reach 10 are the lowest `book_id` zeros: Steam House, then Paris. Around the Moon, The Green Ray, and The Mysterious Island are not in the list.

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

## E2E

Full flows through the running HTTP server.

Here: one flow is enough — create member → borrow → return → verify report.

| What | Why this level | Happy path | Error / edge |
| --- | --- | --- | --- |
| Create member → borrow → return → `GET /reports/top-books` | Crosses several endpoints and persisted state; unit/integration rows do not | — | — |
