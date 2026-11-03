## `GET /members` — B4. N+1 lab

### What it does for the client
Return all members with their current loans. When a response would include many results, the API paginates them and returns a subset.
This makes the response easier to handle for servers and for people.
The endpoint supports the `search=` query parameter, you can search by name: the fragment is matched against the full name, first name then last name.

The endpoint supports the `per_page` query parameter, you can control how many results are returned on a page.
The maximum value of `per_page` is 100.
If you specify a value greater than the maximum, the API does not return an error.
Instead, the value is automatically reduced to the maximum, and the response includes no more than the maximum number of results per page.

The endpoint supports the `page` query parameter, which allows you to select the results page number.
If `page` is greater than the last page, the API does not return an error.
The body is `[]` (same as an empty catalog or a `search` with no matches).

### Method

`GET` — no database writes.

### Request
**Path** — `GET /members`
**Headers:**
- `X-API-Key: abcdef12345`
**Query / body**
- `search=` — case-insensitive substring filter on the full name (`first_name || ' ' || last_name`)
- `page=` — results page number
- `per_page` — number of results per page

Default value of `page=` is 1.
Valid value for `page=`: positive numbers.
Invalid value for `page=`: 0, negative numbers, letters, special characters.

Default value of `per_page` is 50.
Valid value for `per_page=`: positive numbers.
Invalid value for `per_page=`: 0, negative numbers, letters, special characters.

`search` is omitted, or present with an empty value (`search=`): no name filter. Same query as `GET /members` without `search`. A value of only spaces is a fragment, not empty; since every full name contains a space, `search=%20` matches every member and returns the same page as `GET /members`.
`search` with a non-empty value: literal, case-insensitive substring of the **full name** `first_name || ' ' || last_name` — one space between the two names, no trimming, no reordering. `Anna`, `Happy`, `anna happy` and `na Ha` all match `Anna Happy`; `Happy Anna` and `Anna  Happy` (two spaces) do not. Any characters are accepted, including punctuation. `%`, `_`, and `\` in the client value are not `LIKE` wildcards — they match those characters in a name. No `400` for `search`; no match → `200` + `[]`.
A name is free text and may itself contain any character, including `%`, `_`, and `\`; such names must be findable by searching for those characters literally.

### Success

**Status** — `200`
**Body** — JSON array, **at most** `per_page` elements (default 50, capped at 100).
Fewer than `per_page` is valid and means the last page. Empty array is valid: the query succeeded and this page has no rows.
Each element is one member with its **current loans**: only loans whose `returned_at IS NULL`, ordered by `loan_id DESC`. A member without open loans is still an element and carries `loans: []` — the key is always present and always an array. Returned loans never appear. `book` is the book's uuid; the endpoint does not read `books`, so there is no title.

**Element schema:**
```json
{
  "title" : "Member",
  "type" : "object",
  "properties" : {
    "member_id" : {
      "type": "string"
    },
    "first_name" : {
      "type": "string"
    },
    "last_name" : {
      "type": "string"
    },
    "loans": {
      "type": "array",
      "items" : {
        "type": "object",
        "properties" : {
          "loan_id" : {
            "type": "string"
          },
          "book" : {
            "type": "string"
          },
          "borrowed_at": {
            "type": "string",
            "format": "date"
          },
          "due_at" : {
            "type": "string",
            "format": "date"
          }
        }
      }
    }
  }
}
```

### Errors
- `400` — invalid `page` or `per_page` (not a positive integer)

### Side effects

None.

### Limits

- **Query budget: at most 2 SQL statements per HTTP request, independent of `per_page`** — one for the page of members, one for all their open loans (skipped when the page is empty). A per-member loans query would cost 1 + `per_page` statements. The integration test counts statements through the injected `dbClient` and fails above 2.
- No response-time budget is set for this endpoint in the README; the deliverable of the lab is the comparison below.
- Measured on the dev dataset (10,000 members, 500,000 loans), `GET /members` page 1 with 50 members — _to be filled in after both commits_:
  - naive, 1 + N: __ statements, __ ms
  - batch, 1 + 1: 2 statements, __ ms
- Indexes: the loans query uses `idx_loans_member_returned` (`member, returned_at`). The search query compares a concatenation, so no index applies and `members` is scanned sequentially.

### Pagination Math
Limit-offset pagination is straightforward and involves two main parameters:
- Limit: The number of records to fetch.
- Offset: The number of records to skip before starting to fetch the records.

On the user interface side, users typically see pages instead of limit-offset pairs.
However, behind the scenes, these pages are converted to limit-offset using the following simple formula:
- `LIMIT $1`, where $1 is `per_page` parameter.
- `OFFSET = ($2 - 1) * $1`, where $1 is `per_page` parameter; $2 - `page` parameter.

### Query
The endpoint runs two batched queries:
- the first one fetches the page of members
- the second one fetches the open loans of every member on that page

The two queries do not run in one transaction. A `POST /loans` may land between them; for a list that inconsistency is acceptable.

#### First query without search
```sql
SELECT members.member_id,
       members.first_name,
       members.last_name
FROM members
ORDER BY member_id DESC
LIMIT $1 OFFSET $2;
```
where $1 = per_page, $2 = offset from formula.

#### First query with search
If `search` is a non-empty fragment, match it case-insensitively against the full name. Escape `\`, `%`, and `_` in the client value (`\` → `\\`, `%` → `\%`, `_` → `\_`) before binding, then wrap with `%…%`. `ESCAPE '\'` so those sequences stay literals. One expression over the concatenated name, not two `OR`-ed conditions: a fragment may span the space (`na Ha`), and a fragment with a space in the wrong place (`Happy Anna`) must not match.

```sql
SELECT members.member_id,
       members.first_name,
       members.last_name
FROM members
WHERE members.first_name || ' ' || members.last_name ILIKE '%' || $3 || '%' ESCAPE '\'
ORDER BY member_id DESC
LIMIT $1 OFFSET $2;
```
where $1 = per_page, $2 = offset from formula, $3 = escaped fragment.

#### Second query
The second query runs only if the first one returned a non-empty array.

```sql
SELECT loans.loan_id,
       loans.book,
       loans.borrowed_at,
       loans.due_at
FROM loans
WHERE loans.member=ANY($1) AND loans.returned_at IS NULL
ORDER BY loans.loan_id DESC
```
where $1 is a `uuid[]` of the `member_id` values returned by the first query. With `pg` that is a plain JS array of strings; the driver serialises it as a Postgres array.

#### Merge
In JS:
- from the rows of the first query build a `Map` of `member_id<uuid> : member_details<object>`
- `member_details` is an object with the fields `member_id<uuid>`, `first_name<string>`, `last_name<string>`, `loans<array>`
- push the rows of the second query (if it ran) into the `loans<array>` of the matching member, looked up by `row.member`. A row is pushed as is — `loan_id`, `book`, `borrowed_at`, `due_at` are exactly the fields of the element schema — so the order inside `loans` is the order of the SQL rows, `ORDER BY loans.loan_id DESC`; nothing is sorted in JS
- the response is the values of the `Map` in insertion order. `Map` guarantees that order, so the elements come out as `ORDER BY member_id DESC` of the first query; a plain object keyed by uuid would not (its key order is unspecified in practice). Members without loans keep the `loans: []` they got in the first step

### Test fixture (not `../../seed.js`)

Rows live in [`members-fixture.json`](./members-fixture.json), not in this file.

Truncate the test database, then insert that JSON. Deterministic ids — no `gen_random_uuid()` in fixtures. Dates are fixed `YYYY-MM-DD` strings: this endpoint has no "today", so nothing is relative to the clock.

This endpoint lists members with their current loans; it does not read `books` or `authors`. The fixture still has one author, three books and six `book_copies` rows because `loans` has NOT NULL FKs on `book` and `copy_id` — they exist only to make the loans insertable. Each **open** loan sits on its own copy (partial unique index `uidx_borrowed_book_copy`); the three returned loans share copy `…0306`.

Ids use the `00000000-0000-4000-8000-` block: members `…0100`–`…0154`, books `…0201`–`…0203`, copies `…0301`–`…0306`, loans `…0401`–`…0408`, idempotency keys `…0501`–`…0508`.

What this fixture tests regarding query correctness:

- 55 members with `LIMIT 50` — the second page exists and contains 5 items (`…0104` … `…0100`), the third is `[]`
- **N+1 budget.** Page 1 holds 50 members; a per-member loans query is 1 + 50 = 51 statements for this page alone, and 1 + 5 for page 2. The fixed version issues 2 statements (1 when the members page is empty) for both pages. A test that counts statements through the injected `dbClient` sees the difference without timing anything.
- 8 loans, 5 of them open. **Only open loans (`returned_at IS NULL`) are "current"**:
  - `…0154` Anna Happy — two open loans; `…0402` has the earlier `due_at` but the larger `loan_id`, so it comes first both under `due_at ASC` and under `loan_id DESC`; either way the array is not in insertion order
  - `…0153` Boris Owner — one open + two returned → one element in `loans`. A loans query without `returned_at IS NULL` returns three
  - `…0148` Olena Koval — one returned loan only → `loans: []`. The member comes from the first query, so the second query cannot drop him; a single-query JOIN that filtered `returned_at` in `WHERE` would
  - `…0151` Lee Wilson — one open loan whose `due_at` is in the past: overdue is still current
  - `…0102` — one open loan on **page 2**, so a fix that only batches the first page is caught
- the other 48 members have no loans at all — the merge step must give them `loans: []`, not `undefined` and not a missing key
- `search` is matched against the **full name** `first_name || ' ' || last_name`, case-insensitively: `lee` hits `Clara Lee` (`…0152`, last name), `Lee Wilson` (`…0151`, first name) and `kaylee Brown` (`…0149`, lower-case substring). No other full name contains `lee`
- the fragment may span the space: `na Ha` and `Anna Happy` match only `…0154`. Two `OR`-ed per-column conditions would find neither, because no single column contains `na Ha`. `Happy Anna` matches nobody: the order first name, last name is fixed
- a value of only spaces is a fragment that every full name contains, so `search=%20` returns page 1 unchanged
- exactly one name contains `_` (`Ann_Marie Smith`, `…0150`) and none contains `%` — `search=_` must return only that member, `search=%25` must return `[]`. An unescaped fragment would turn both into wildcards and return every member

### Expected response (`200`)

No `search`, default `per_page=50`. Computed from the fixture after `ORDER BY member_id DESC`; inside each member `loans` follows the `ORDER BY` of the loans query. Returned loans are absent: only `returned_at IS NULL` rows are current.

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
