
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
  - `GET /members?page=1&per_page=50` => `{ page: 1, per_page: 50 }`;
  - `GET /members` or `GET /members?search=` => `{ page: 1, per_page: 50 }`;
  - `GET /members?search=%20` => `{ page: 1, per_page: 50, search: " " }`;
  - `GET /members?per_page=101` parses (clamp is pagination math);
  - `GET /members?search=%25` and `GET /members?search=_` parse
  - `POST /loans` body `{ member: uuid, book: uuid }` + `Idempotency-Key` uuid v4 parses
  - `POST /loans/:id/return` uuid v4 parses
- **Error / edge:** 
  - `GET /books?page=0`, `page=-1`, `page=abc`, `page=1.5` => invalid page (not a positive integer)
  - `GET /books?per_page=0`, `per_page=-1`, `per_page=abc`, `per_page=1.5` → invalid per_page (not a positive integer)
  - `GET /members?page=0`, `page=-1`, `page=abc`, `page=1.5` => invalid page (not a positive integer)
  - `GET /members?per_page=0`, `per_page=-1`, `per_page=abc`, `per_page=1.5` → invalid per_page (not a positive integer)
  - `POST /loans` body: `member` / `book` missing or wrong type → invalid (HTTP mapping is integration `422`)
  - `POST /loans` `Idempotency-Key` missing, empty string, not a uuid, or uuid v1 → invalid on field `idempotencyKey` (HTTP mapping is integration `422` with `details[].field = "Idempotency-Key"`). Each invalid case keeps the other fields valid, so it fails only for the reason in its name
  - `POST /loans/:id/return` wrong uuid type → invalid (HTTP mapping is integration `422`)

## Integration

Own code + real Postgres. Do not mock `pg`.

Here: every endpoint against a real test Postgres (Docker), repositories/queries, the borrow transaction.

Auth-lite is HTTP contract (status + header), not limiter arithmetic (that is unit) and not a full user journey (that is E2E). These rows do not require seeded books.

Error bodies (all endpoints): assert `statusCode`, `error`, and `message`. Do not deep-equal the whole body. `requestId` (a UUID v4 equal to `X-Request-Id`) is produced by the request-id middleware and the central error handler, not by any route, so it is asserted once as a mechanism — in the auth-lite tests via `assertEnvelopeId` and in the unit test for the request id — rather than repeated in every endpoint's error case.

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
  - `GET /books?page=2` => `200` + JSON below (page 2 with 5 items)
  - `GET /books?page=3` => `200` + `[]`
  - `GET /books?per_page=15`, `GET /books?per_page=100` => `200` + JSON below (page 1 with 15 items)
  - `GET /books?search=Around` => `200` + JSON below (page 1 with 3 items)
  - `GET /books?search=around the moon` => `200` + JSON below (page 1 with 2 items)
  - `GET /books?search=%25`, `GET /books?search=50%25` => `200` + JSON below (page 1 with 1 item: the only title with a literal `%`)
  - `GET /books?search=_` => `200` + `[]` (no title contains `_`; a wildcard would match everything)
- **Error / edge:** n/a (invalid `page` / `per_page` is the next item)

#### Expected body for `GET /books?search=&page=&per_page` (`200`)

Calculated based on the fixture from `api-contracts/pagination-fixture.json`. The `search` parameter is absent; the default value is `per_page=10`. The calculation was performed based on the fixture after applying `ORDER BY book_id DESC`.

`GET /books` or `GET /books?page=1` — 10 items:

```json
[
  { "book_id": "00000000-0000-0000-0000-000000000014", "title": "50% of the Earth", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000013", "title": "Around the Moon", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000012", "title": "The Mysterious Island", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000011", "title": "The Green Ray", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000010", "title": "around the moon", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000009", "title": "Paris in the Twentieth Century", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000008", "title": "The Steam House", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000007", "title": "Robur the Conqueror", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000006", "title": "In Search of the Castaways", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000005", "title": "Five Weeks in a Balloon", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" }
]
```

`GET /books?page=2` — 5 items (last page, `length < per_page`):

```json
[
  { "book_id": "00000000-0000-0000-0000-000000000004", "title": "Michael Strogoff", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000003", "title": "From the Earth to the Moon", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000002", "title": "Journey to the Centre of the Earth", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000001", "title": "Around the World in 80 Days", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000000", "title": "Twenty Thousand Leagues", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" }
]
```

`GET /books?page=3` → `[]`.

`GET /books?per_page=15`, `GET /books?per_page=100` — 15 items:
```json
[
  { "book_id": "00000000-0000-0000-0000-000000000014", "title": "50% of the Earth", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
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

`GET /books?search=%25`, `GET /books?search=50%25` 1 item (literal `%`, not a wildcard):
```json
[
  { "book_id": "00000000-0000-0000-0000-000000000014", "title": "50% of the Earth", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" }
]
```

### `GET /books` — invalid pagination parameters

- **Why this level:** HTTP status mapping; no SQL
- **Happy path:** n/a
- **Error / edge:**
  - `page` or `per_page` set to `0`, `-1`, `abc`, or `1.5` (one parameter at a time, the other absent) => `400` `bad_request` (invalid query parameter; no `details`). Same envelope for both parameters, so one parametrised test covers all eight URLs

### `GET /members` — B4. N+1 lab

- **Why this level:** Real queries to Postgres; only open loans, `loans: []` for members without them and the order inside `loans` are query results, not an `if`
- **Happy path:**
  - `GET /members`, `GET /members?page=1`, `GET /members?search=` => `200` + JSON below (page 1 with 50 items)
  - `GET /members?page=2` => `200` + JSON below (page 2 with 5 items; `…0102` keeps its open loan, so batching only the first page is caught)
  - `GET /members?page=3` => `200` + `[]`
  - `GET /members?per_page=55`, `GET /members?per_page=100` => `200` + 55 items: the 50 items of page 1 followed by the 5 items of page 2, in that order (one array, not two)
  - `GET /members?per_page=2` => `200` + JSON below (page 1 with 2 items)
  - `GET /members?search=lee` => `200` + JSON below (3 items: last name, first name, lower-case substring)
  - `GET /members?search=_` => `200` + JSON below (1 item: the only name with a literal `_`)
  - `GET /members?search=Anna Happy`, `GET /members?search=na Ha` => `200` + JSON below (1 item: the fragment spans the space)
  - `GET /members?search=Happy Anna` => `200` + `[]` (last name before first name never matches)
  - `GET /members?search=%20` => `200` + same body as `GET /members` (every full name contains a space)
  - `GET /members?search=%25` => `200` + `[]` (no name contains `%`; a wildcard would match everything)
  - `GET /members?search=zzz` => `200` + `[]`
- **Error / edge:** n/a (invalid `page` / `per_page` is the next item)

#### Expected body for `GET /members?search=&page=&per_page` (`200`)

Calculated based on the fixture from `api-contracts/members-fixture.json`. The `search` parameter is absent; the default value is `per_page=50`. The calculation was performed based on the fixture after applying `ORDER BY member_id DESC`; inside each member `loans` follows `ORDER BY loan_id DESC`. Returned loans are absent: only `returned_at IS NULL` rows are current.

`GET /members`, `GET /members?page=1`, `GET /members?search=` — 50 items:

```json
[
  { "member_id": "00000000-0000-4000-8000-000000000154", "first_name": "Anna", "last_name": "Happy", "loans": [
      { "loan_id": "00000000-0000-4000-8000-000000000402", "book": "00000000-0000-4000-8000-000000000202", "borrowed_at": "2026-09-01", "due_at": "2026-09-15" },
      { "loan_id": "00000000-0000-4000-8000-000000000401", "book": "00000000-0000-4000-8000-000000000201", "borrowed_at": "2026-09-03", "due_at": "2026-09-17" }
    ]
  },
  { "member_id": "00000000-0000-4000-8000-000000000153", "first_name": "Boris", "last_name": "Owner", "loans": [
      { "loan_id": "00000000-0000-4000-8000-000000000403", "book": "00000000-0000-4000-8000-000000000201", "borrowed_at": "2026-09-05", "due_at": "2026-09-19" }
    ]
  },
  { "member_id": "00000000-0000-4000-8000-000000000152", "first_name": "Clara", "last_name": "Lee", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000151", "first_name": "Lee", "last_name": "Wilson", "loans": [
      { "loan_id": "00000000-0000-4000-8000-000000000406", "book": "00000000-0000-4000-8000-000000000203", "borrowed_at": "2026-08-20", "due_at": "2026-09-03" }
    ]
  },
  { "member_id": "00000000-0000-4000-8000-000000000150", "first_name": "Ann_Marie", "last_name": "Smith", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000149", "first_name": "kaylee", "last_name": "Brown", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000148", "first_name": "Olena", "last_name": "Koval", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000147", "first_name": "Melissa", "last_name": "Carter", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000146", "first_name": "George", "last_name": "Mitchell", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000145", "first_name": "Amanda", "last_name": "Campbell", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000144", "first_name": "Brian", "last_name": "Rivera", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000143", "first_name": "Carol", "last_name": "Hall", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000142", "first_name": "Kevin", "last_name": "Baker", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000141", "first_name": "Dorothy", "last_name": "Nelson", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000140", "first_name": "Kenneth", "last_name": "Adams", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000139", "first_name": "Michelle", "last_name": "Green", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000138", "first_name": "Joshua", "last_name": "Flores", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000137", "first_name": "Donna", "last_name": "Hill", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000136", "first_name": "Andrew", "last_name": "Nguyen", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000135", "first_name": "Emily", "last_name": "Torres", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000134", "first_name": "Paul", "last_name": "Scott", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000133", "first_name": "Kimberly", "last_name": "Wright", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000132", "first_name": "Steven", "last_name": "King", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000131", "first_name": "Ashley", "last_name": "Allen", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000130", "first_name": "Donald", "last_name": "Young", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000129", "first_name": "Sandra", "last_name": "Walker", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000128", "first_name": "Mark", "last_name": "Robinson", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000127", "first_name": "Margaret", "last_name": "Lewis", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000126", "first_name": "Anthony", "last_name": "Ramirez", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000125", "first_name": "Betty", "last_name": "Clark", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000124", "first_name": "Matthew", "last_name": "Sanchez", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000123", "first_name": "Nancy", "last_name": "Harris", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000122", "first_name": "Daniel", "last_name": "White", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000121", "first_name": "Lisa", "last_name": "Thompson", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000120", "first_name": "Charles", "last_name": "Perez", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000119", "first_name": "Karen", "last_name": "Martin", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000118", "first_name": "Christopher", "last_name": "Jackson", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000117", "first_name": "Sarah", "last_name": "Moore", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000116", "first_name": "Thomas", "last_name": "Taylor", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000115", "first_name": "Jessica", "last_name": "Thomas", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000114", "first_name": "Joseph", "last_name": "Anderson", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000113", "first_name": "Susan", "last_name": "Wilson", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000112", "first_name": "Richard", "last_name": "Gonzalez", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000111", "first_name": "Barbara", "last_name": "Lopez", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000110", "first_name": "William", "last_name": "Hernandez", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000109", "first_name": "Elizabeth", "last_name": "Martinez", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000108", "first_name": "David", "last_name": "Rodriguez", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000107", "first_name": "Linda", "last_name": "Davis", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000106", "first_name": "Michael", "last_name": "Miller", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000105", "first_name": "Jennifer", "last_name": "Garcia", "loans": [] }
]
```

`GET /members?page=2` — 5 items (last page, `length < per_page`):

```json
[
  { "member_id": "00000000-0000-4000-8000-000000000104", "first_name": "John", "last_name": "Jones", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000103", "first_name": "Patricia", "last_name": "Brown", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000102", "first_name": "Robert", "last_name": "Williams", "loans": [
      { "loan_id": "00000000-0000-4000-8000-000000000408", "book": "00000000-0000-4000-8000-000000000202", "borrowed_at": "2026-09-10", "due_at": "2026-09-24" }
    ]
  },
  { "member_id": "00000000-0000-4000-8000-000000000101", "first_name": "Mary", "last_name": "Johnson", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000100", "first_name": "James", "last_name": "Smith", "loans": [] }
]
```

`GET /members?page=3` → `[]`.

`GET /members?per_page=55`, `GET /members?per_page=100` — 55 items: the 50 items of page 1 followed by the 5 items of page 2, in that order (one array, not two).

`GET /members?per_page=2` — 2 items (the two members with the most interesting loans; handy for a quick manual check):

```json
[
  { "member_id": "00000000-0000-4000-8000-000000000154", "first_name": "Anna", "last_name": "Happy", "loans": [
      { "loan_id": "00000000-0000-4000-8000-000000000402", "book": "00000000-0000-4000-8000-000000000202", "borrowed_at": "2026-09-01", "due_at": "2026-09-15" },
      { "loan_id": "00000000-0000-4000-8000-000000000401", "book": "00000000-0000-4000-8000-000000000201", "borrowed_at": "2026-09-03", "due_at": "2026-09-17" }
    ]
  },
  { "member_id": "00000000-0000-4000-8000-000000000153", "first_name": "Boris", "last_name": "Owner", "loans": [
      { "loan_id": "00000000-0000-4000-8000-000000000403", "book": "00000000-0000-4000-8000-000000000201", "borrowed_at": "2026-09-05", "due_at": "2026-09-19" }
    ]
  }
]
```

`GET /members?search=lee` — 3 items, `ORDER BY member_id DESC`, matched on last name, first name and a lower-case substring:

```json
[
  { "member_id": "00000000-0000-4000-8000-000000000152", "first_name": "Clara", "last_name": "Lee", "loans": [] },
  { "member_id": "00000000-0000-4000-8000-000000000151", "first_name": "Lee", "last_name": "Wilson", "loans": [
      { "loan_id": "00000000-0000-4000-8000-000000000406", "book": "00000000-0000-4000-8000-000000000203", "borrowed_at": "2026-08-20", "due_at": "2026-09-03" }
    ]
  },
  { "member_id": "00000000-0000-4000-8000-000000000149", "first_name": "kaylee", "last_name": "Brown", "loans": [] }
]
```

`GET /members?search=_` → the single member `…0150` (`Ann_Marie Smith`, no loans):

```json
[
  { "member_id": "00000000-0000-4000-8000-000000000150", "first_name": "Ann_Marie", "last_name": "Smith", "loans": [] }
]
```

`GET /members?search=Anna Happy` and `GET /members?search=na Ha` → the single member `…0154` (the fragment spans the space between first and last name):

```json
[
  { "member_id": "00000000-0000-4000-8000-000000000154", "first_name": "Anna", "last_name": "Happy", "loans": [
      { "loan_id": "00000000-0000-4000-8000-000000000402", "book": "00000000-0000-4000-8000-000000000202", "borrowed_at": "2026-09-01", "due_at": "2026-09-15" },
      { "loan_id": "00000000-0000-4000-8000-000000000401", "book": "00000000-0000-4000-8000-000000000201", "borrowed_at": "2026-09-03", "due_at": "2026-09-17" }
    ]
  }
]
```

`GET /members?search=Happy Anna` → `[]` (last name before first name never matches).

`GET /members?search=%20` (a single space) — same body as `GET /members`: every full name contains a space.

`GET /members?search=%25` → `[]`. On the wire the percent sign is `%25`; a raw `search=%` is incomplete percent-encoding, not this case.

`GET /members?search=zzz` → `[]`.

### `GET /members` — query budget (N+1)

- **Why this level:** The statement count is only visible against a real `pg` client; counted through the injected `dbClient`, no timing
- **Happy path:**
  - `GET /members` (page 1, 50 members) => at most 2 SQL statements (a per-member loans query would be 1 + 50 = 51)
  - `GET /members?page=2` (5 members) => at most 2 statements (naive: 1 + 5)
- **Error / edge:**
  - `GET /members?page=3` (empty page) => 1 statement: the loans query is skipped

### `GET /members` — invalid pagination parameters

- **Why this level:** HTTP status mapping; no SQL
- **Happy path:** n/a
- **Error / edge:**
  - `page` or `per_page` set to `0`, `-1`, `abc`, or `1.5` (one parameter at a time, the other absent) => `400` `bad_request` (invalid query parameter; no `details`). Same envelope for both parameters, so one parametrised test covers all eight URLs


### `POST /loans` — transactional borrow

- **Why this level:** Real transaction, constraints, `409` on conflict
- **Happy path:**
  - Anna (member: ...101) + Available Book (book: ...201), fresh `Idempotency-Key` => `201` + `{loan_id, member, book, borrowed_at, due_at}` (no `returned_at`); `borrowed_at` is `CURRENT_DATE`, `due_at` is `CURRENT_DATE + 14 days` — assert a `loans` row created with a `copy_id` assigned
  - same call repeated with the **same** `Idempotency-Key` => `201`, same `loan_id` as the first call — assert no second row inserted
  - parallel calls with Anna (member: ...101), Available Book (book: ...201), same `Idempotency-Key` => both `201`, **identical `loan_id`** in both responses — assert exactly **one** row in `loans` for that `idempotency_key`. The test holds each call after its idempotency-key lookup has returned no row, and releases both only then, so both reach the insert of the only free copy (`...301`) before either commits
  - Anna (member: ...101) + Multi-Copy Book (book: ...204), one of two copies already on loan (...304) => `201` — assert the new row uses the free copy (`...305`), not `...304`
- **Error / edge:**
  - unknown_member_id (member: ...999) => `404` `not_found` : `Member with id:00000000-...-999 undefined`
  - unknown_book_id (book: ...998) => `404` `not_found` : `Book with id:00000000-...-998 undefined`
  - Booked Out Book (book: ...203), without an available copy => `409` `conflict` : `copy already taken, conflict`
  - invalid `Content-Type` => `400` `bad_request`
  - malformed body (`member`/`book` missing or wrong type) => `422` `validation_error` with `details`
  - missing or non-uuid-v4 `Idempotency-Key` header, valid body => `422` `validation_error` with `details[].field = "Idempotency-Key"` — assert no `loans` row inserted
  - same `Idempotency-Key`, Anna (member: ...101): first Available Book (book: ...201) => `201`, then Multi-Copy Book (book: ...204) => `422` `validation_error` `Idempotency-Key already used with a different member or book` (no `details` key) — assert exactly one `loans` row for that key, and its `book` is Available Book. Multi-Copy still has a free copy (`...305`), so a `409` for a missing copy cannot stand in for the `422`
  - same `Idempotency-Key`: first Anna (member: ...101) + Available Book (book: ...201) => `201`, then Boris (member: ...102) + Available Book => the same `422` (no `details` key) — assert no second `loans` row for that key
  - parallel calls with Anna (member: ...101) + Available Book (book: ...201) / Multi-Copy Book (book: ...204), same `Idempotency-Key` => exactly one `201` + `{loan_id, member, book, borrowed_at, due_at}`, exactly one `422` `validation_error` `Idempotency-Key already used with a different member or book` (no `details` key) — assert exactly one `loans` row for that `idempotency_key`, and its `book` equals `book` in the `201`. The test holds each call after its idempotency-key lookup has returned no row, and releases both only then, so both reach the insert before either commits

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
  - missing or non-uuid-v4 `id` parameter `422` `validation_error` with `details[].field = "id"` — assert no `loans` row remove

## E2E

Full flows through the running HTTP server.

README Part D’s example starts with **create member → borrow → return → verify report**. The first step does not match Part C: there is no `POST /members` (or any member-write endpoint). Members exist only in seed/fixtures. E2E therefore starts from an already-seeded member.

### Seeded member → borrow → return → `GET /reports/top-books`

- **Why this level:** Crosses several endpoints and persisted state; unit/integration items do not
- **Happy path:** loans fixture; Anna (`...101`) `POST /loans` Available Book (`...201`) with a fresh `Idempotency-Key` → `201`; `POST /loans/:id/return` on that `loan_id` → `200` with `returned_at` set; `GET /reports/top-books` → `200` and Available Book is in the ranking (`borrow_count >= 1`; returned loans still count). Do not assert the JSON from `top-books-fixture.json` — that is a different seed
- **Error / edge:** n/a
