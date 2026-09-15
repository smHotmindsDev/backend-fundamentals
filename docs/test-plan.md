# Test plan

What is tested at which level, and why.

One behaviour = one item. Fill before writing tests. Items with empty Happy / Error wait on a contract in `api-contracts/`.

## Unit

Pure logic in isolation, no I/O. Fast (ms), many.

Here: pagination math, rate-limiter logic, validation schemas.

### Per-key rate limiter

- **Why this level:** In-memory counter; no I/O
- **Happy path:** 5 requests in the 60s window → allow
- **Error / edge:** 6th before `resetTime` → deny; after `resetTime` → allow again

### Pagination math (`GET /books`)

- **Why this level:** Offset/limit arithmetic is pure
- **Happy path:** 
  - `GET /books?page=1&per_page=10` → `LIMIT 10 OFFSET 0`; 
  - `GET /books?page=2&per_page=10` → `LIMIT 10 OFFSET 10`; 
  - `GET /books?per_page=101` → `LIMIT 100 OFFSET 0`
- **Error / edge:**
  - n/a

### Validation schemas (Zod)

- **Why this level:** Parses input in memory
- **Happy path:** 
  - `GET /books?page=1&per_page=10` => `{ page: 1, per_page: 10 }`; 
  - `GET /books` or `GET /books?search=` => `{ page: 1, per_page: 10 }`; 
  - `GET /books?search=%20` => `{ page: 1, per_page: 10, search: " " }`;
  - `GET /books?per_page=101` parses (clamp is pagination math); 
  - `GET /books?search=%25` and `GET /books?search=_` parse
  - `POST /loans` body `{ member: uuid, book: uuid }` parses
- **Error / edge:** 
  - `GET /books?page=0`, `page=-1`, `page=abc`, `page=1.5` => invalid page (not a positive integer)
  - `GET /books?per_page=0`, `per_page=-1`, `per_page=abc`, `per_page=1.5` → invalid per_page (not a positive integer)
  - `POST /loans` body: `member` / `book` missing or wrong type → invalid (HTTP mapping is integration `422`)

## Integration

Own code + real Postgres. Do not mock `pg`.

Here: every endpoint against a real test Postgres (Docker), repositories/queries, the borrow transaction.

Auth-lite is HTTP contract (status + header), not limiter arithmetic (that is unit) and not a full user journey (that is E2E). These rows do not require seeded books.

Error bodies (all endpoints): assert `statusCode`, `error`, and `message`; `requestId` is a UUID v4 and equals `X-Request-Id`. Do not deep-equal the whole body.

### Auth-lite: `X-API-Key` header

- **Why this level:** HTTP status mapping; no SQL
- **Happy path:** Valid `X-API-Key` → request continues
- **Error / edge:** Missing or wrong key → `401` `invalid_auth`, same `message` (`No valid API key provided`); valid key, 6th request in the window → `429` `rate_limit_error` (`Rate limit exceeded.`); junk keys do not consume the limiter

### `GET /reports/top-books` — empty database

- **Why this level:** Empty ranking is a query result, not an `if`
- **Happy path:** `200` + `[]`
- **Error / edge:** n/a

### `GET /reports/top-books` — ranked report

- **Why this level:** Mocking `pg` cannot prove `COUNT`, the 90-day window, or `ORDER BY`
- **Happy path:** `200` + JSON below (window count, tie-break, zeros)
- **Error / edge:** n/a

Response-time budget for `GET /reports/top-books` (200 ms on ~500k loans): **not** in this suite. Check the query plan / measure locally on the full dataset. Functional tests use the tiny seed below.

#### Expected body for `GET /reports/top-books` (`200`)

Computed from the fixture in `api-contracts/top-books-fixture.json` **after** `borrowed_at >= CURRENT_DATE - 90 days`. Inserted loans outside the window count as 0 (Steam House 42 @ 91d, Mysterious Island 100 @ 100d). Tie 44/44: Castaways `…0006` before Robur `…0007`. The two extra slots to reach 10 are the lowest `book_id` zeros: Steam House, then Paris. Around the Moon, The Green Ray, and The Mysterious Island are not in the list.

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

### `GET /books` — pagination

- **Why this level:** Real `LIMIT`/`OFFSET` against Postgres
- **Happy path:** 
  - `GET /books`, `GET /books?page=1`, `GET /books?search=` => `200` + JSON below (page 1 with 10 items)
  - `GET /books?page=2` => `200` + JSON below (page 2 with 4 items)
  - `GET /books?page=3` => `200` + `[]`
  - `GET /books?per_page=14`, `GET /books?per_page=100` => `200` + JSON below (page 1 with 14 items)
  - `GET /books?search=Around` => `200` + JSON below (page 1 with 3 items)
  - `GET /books?search=around the moon` => `200` + JSON below (page 1 with 2 items)
  - `GET /books?search=%25`, `GET /books?search=_` => `200` + `[]`
- **Error / edge:** n/a (invalid `page` / `per_page` is the next item)

#### Expected body for `GET /books?search=&page=&per_page` (`200`)

Calculated based on the fixture from `api-contracts/pagination-fixture.json`. The `search` parameter is absent; the default value is `per_page=10`. The calculation was performed based on the fixture after applying `ORDER BY book_id DESC`.

`GET /books` or `GET /books?page=1` — 10 items:

```json
[
  { "book_id": "00000000-0000-0000-0000-000000000013", "title": "Around the Moon", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000012", "title": "The Mysterious Island", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000011", "title": "The Green Ray", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000010", "title": "around the moon", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000009", "title": "Paris in the Twentieth Century", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000008", "title": "The Steam House", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000007", "title": "Robur the Conqueror", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000006", "title": "In Search of the Castaways", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000005", "title": "Five Weeks in a Balloon", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000004", "title": "Michael Strogoff", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" }
]
```

`GET /books?page=2` — 4 items (last page, `length < per_page`):

```json
[
  { "book_id": "00000000-0000-0000-0000-000000000003", "title": "From the Earth to the Moon", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000002", "title": "Journey to the Centre of the Earth", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000001", "title": "Around the World in 80 Days", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000000", "title": "Twenty Thousand Leagues", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" }
]
```

`GET /books?page=3` → `[]`.

`GET /books?per_page=14`, `GET /books?per_page=100` — 14 items:
```json
[
  { "book_id": "00000000-0000-0000-0000-000000000013", "title": "Around the Moon", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000012", "title": "The Mysterious Island", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000011", "title": "The Green Ray", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000010", "title": "around the moon", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000009", "title": "Paris in the Twentieth Century", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000008", "title": "The Steam House", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000007", "title": "Robur the Conqueror", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000006", "title": "In Search of the Castaways", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000005", "title": "Five Weeks in a Balloon", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000004", "title": "Michael Strogoff", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000003", "title": "From the Earth to the Moon", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000002", "title": "Journey to the Centre of the Earth", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000001", "title": "Around the World in 80 Days", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000000", "title": "Twenty Thousand Leagues", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" }
]
```

`GET /books?search=Around` 3 items:
```json
[
  { "book_id": "00000000-0000-0000-0000-000000000013", "title": "Around the Moon", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000010", "title": "around the moon", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000001", "title": "Around the World in 80 Days", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" }
]
```
`GET /books?search=around the moon` 2 items:
```json
[
  { "book_id": "00000000-0000-0000-0000-000000000013", "title": "Around the Moon", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000010", "title": "around the moon", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" }
]
```

### `GET /books` — invalid pagination parameters

- **Why this level:** HTTP status mapping; no SQL
- **Happy path:** n/a
- **Error / edge:**
  - `GET /books?page=0`, `page=-1`, `page=abc`, `page=1.5` => `400` `bad_request` (invalid query parameter; no `details`)
  - `GET /books?per_page=0`, `per_page=-1`, `per_page=abc`, `per_page=1.5` => `400` `bad_request` (invalid query parameter; no `details`)

### `POST /loans` — transactional borrow

- **Why this level:** Real transaction, constraints, `409` on conflict
- **Happy path:**
  - Anna (member: ...101) + Available Book (book: ...201), fresh `Idempotency-Key` => `201` + `{loan_id, member, book, borrowed_at, due_at}` (no `returned_at`); `borrowed_at` is `CURRENT_DATE`, `due_at` is `CURRENT_DATE + 14 days` — assert a `loans` row created with a `copy_id` assigned
  - same call repeated with the **same** `Idempotency-Key` => `201`, same `loan_id` as the first call — assert no second row inserted
  - parallel calls with Anna (member: ...101), Available Book (book: ...201), same `Idempotency-Key` => both `201`, **identical `loan_id`** in both responses — assert exactly **one** row in `loans` for that `idempotency_key`
  - Anna (member: ...101) + Multi-Copy Book (book: ...204), one of two copies already on loan (...304) => `201` — assert the new row uses the free copy (`...305`), not `...304`
- **Error / edge:**
  - unknown_member_id (member: ...999) => `404` `not_found` : `Member with id:00000000-...-999 undefined`
  - unknown_book_id (book: ...998) => `404` `not_found` : `Book with id:00000000-...-998 undefined`
  - Booked Out Book (book: ...203), without an available copy => `409` `conflict` : `copy already taken, conflict`
  - invalid `Content-Type` => `400` `bad_request`
  - malformed body (`member`/`book` missing or wrong type) => `422` `validation_error` with `details`

### `POST /loans` — double-borrow race

- **Why this level:** Two parallel borrows of the last copy; exactly one succeeds
- **Happy path:**
  - parallel calls from Anna (member: ...101), Boris (member: ...102) to Contested Book (book: ...202) => exactly one `201` + `{loan_id, member, book, borrowed_at, due_at}`, exactly one `409` `conflict` `copy already taken, conflict` — assert **exactly one open `loans` row** for `copy_id: ...302` after both calls resolve, and that its `member` matches whichever response returned `201`
- **Error / edge:** n/a

### `POST /loans/:id/return` — idempotent return

- **Why this level:** Second return is `200` no-op; assert DB state
- **Happy path:** 
  - loan (loan_id:...403) (`Returnable Book`), `returned_at` IS NULL => `200` + `{loan_id, member, book, borrowed_at, due_at, returned_at}`; `returned_at` is `CURRENT_DATE`
  - same `POST` again (loan_id:...403, `returned_at` already set) => `200` + the same body — assert `returned_at` identical to the first call (no-op)
  - parallel calls with loan (loan_id:...403) (`Returnable Book`), `returned_at` IS NULL => both `200` + `{loan_id, member, book, borrowed_at, due_at, returned_at}` — assert identical `returned_at` in both responses and in the `loans` row. Do not return `...401` or `...402` (those rows belong to the borrow fixture)
- **Error / edge:**
  - unknown_loan_id (id:...997) => `404` `not_found` : `Loan with id:00000000-...-997 undefined`

## E2E

Full flows through the running HTTP server.

README Part D’s example starts with **create member → borrow → return → verify report**. The first step does not match Part C: there is no `POST /members` (or any member-write endpoint). Members exist only in seed/fixtures. E2E therefore starts from an already-seeded member.

### Seeded member → borrow → return → `GET /reports/top-books`

- **Why this level:** Crosses several endpoints and persisted state; unit/integration items do not
- **Happy path:** loans fixture; Anna (`...101`) `POST /loans` Available Book (`...201`) with a fresh `Idempotency-Key` → `201`; `POST /loans/:id/return` on that `loan_id` → `200` with `returned_at` set; `GET /reports/top-books` → `200` and Available Book is in the ranking (`borrow_count >= 1`; returned loans still count). Do not assert the JSON from `top-books-fixture.json` — that is a different seed
- **Error / edge:** n/a
