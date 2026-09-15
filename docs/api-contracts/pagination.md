## `GET /books?search=&page=` — pagination

### What it does for the client
Return all books. When a response would include many results, will paginate the results and return a subset of the results.
This makes the response easier to handle for servers and for people.
The endpoint supports the `search=` query parameter, you can search by book title.

The endpoint supports the `per_page` query parameter, you can control how many results are returned on a page.
The maximum value of `per_page` is 100. 
If you specify a value greater than the maximum, API does not return an error. 
Instead, the value is automatically reduced to the maximum, and the response includes no more than the maximum number of results per page.

The endpoint supports the `page` query parameter, which allows you to select the results page number.
If `page` is greater than the last page, the API does not return an error.
The body is `[]` (same as an empty catalog or a `search` with no matches).

### Method

`GET` — no database writes.

### Request
**Path** — `GET /books?search=&page=&per_page=`
**Headers:**
- `X-API-Key: abcdef12345`
**Query / body** 
- `search=` — substring filter on book title (case-insensitive)
- `page=` — results page number
- `per_page` — number of results per page

Default value of `page=` is 1.
Valid value for `page=`: positive numbers.
Invalid value for `page=`: 0, negative numbers, letters, special characters.

Default value of `per_page` is 10.
Valid value for `per_page=`: positive numbers.
Invalid value for `per_page=`: 0, negative numbers, letters, special characters.

`search` is omitted, or present with an empty value (`search=`): no title filter. Same query as `GET /books` without `search`. A value of only spaces is a fragment, not empty.
`search` with a non-empty value: literal substring of `title`. Any characters are accepted, including punctuation. `%`, `_`, and `\` in the client value are not `LIKE` wildcards — they match those characters in a title. No `400` for `search`; no match → `200` + `[]`.

### Success

**Status** — `200`
**Body** — JSON array, **at most** `per_page` elements (default 10, capped at 100).
Fewer than `per_page` is valid and means the last page. Empty array is valid: the query succeeded and this page has no rows.

**Element schema:**
```json
{
  "title" : "Book",
  "type" : "object",
  "properties" : {
    "book_id" : {
      "type": "string"
    },
    "title" : {
      "type": "string"
    },
    "author" : {
      "type": "string"
    },
    "published_at": { 
      "type": "string", 
      "format": "date"
    }
  }
}
```

### Errors
- `400` — invalid `page` or `per_page` (not a positive integer)

### Side effects

None.

### Pagination Math
Limit-offset pagination is straightforward and involves two main parameters:
- Limit: The number of records to fetch.
- Offset: The number of records to skip before starting to fetch the records.

On the user interface side, users typically see pages instead of limit-offset pairs. 
However, behind the scenes, these pages are converted to limit-offset using the following simple formula:
- `LIMIT $1`, where $1 is `per_page` parameter.
- `OFFSET = ($2 - 1) * $1`, where $1 is `per_page` parameter; $2 - `page` parameter.

### Query
```sql
SELECT * 
FROM books 
ORDER BY book_id DESC 
LIMIT $1 OFFSET $2;
```

If `search` is a non-empty fragment, use full-text-ish case-insensitive search. Escape `\`, `%`, and `_` in the client value (`\` → `\\`, `%` → `\%`, `_` → `\_`) before binding, then wrap with `%…%`. `ESCAPE '\'` so those sequences stay literals:

```sql
SELECT *
FROM books
WHERE books.title ILIKE '%' || $3 || '%' ESCAPE '\'
ORDER BY book_id DESC
LIMIT $1 OFFSET $2;
```
where $1 = per_page, $2 = offset from formula, $3 = escaped fragment.

### Test fixture (not `../../seed.js`)

Rows live in [`pagination-fixture.json`](./pagination-fixture.json), not in this file.

Truncate the test database, then insert that JSON. Deterministic ids — no `gen_random_uuid()` in fixtures.

One author. This endpoint lists books; it does not read `book_copies` or `loans`.

What this fixture tests regarding query correctness:

- 14 books with `LIMIT 10` — the second page exists and contains 4 items
- `around the moon` (`…0010`) and `Around the Moon` (`…0013`) — verifying `ILIKE` case-insensitivity and the deterministic tie-breaker based on `book_id`
- no title contains `%` or `_` — `search=%` and `search=_` must return `[]`, proving the fragment is literal, not a `LIKE` pattern

### Expected response (`200`)

No `search`, default `per_page=10`. Computed from the fixture after `ORDER BY book_id DESC`.

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

`GET /books?search=` (empty value) — same body as `GET /books`.

`GET /books?search=%` and `GET /books?search=_` → `[]`. On the wire the percent sign is `%25` (`search=%25`); a raw `search=%` is incomplete percent-encoding, not this case.

`GET /books?search=Around` — 3 items, `ORDER BY book_id DESC`:

```json
[
  { "book_id": "00000000-0000-0000-0000-000000000013", "title": "Around the Moon", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000010", "title": "around the moon", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000001", "title": "Around the World in 80 Days", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" }
]
```

`GET /books?search=around the moon` — 2 items, `ORDER BY book_id DESC`:

```json
[
  { "book_id": "00000000-0000-0000-0000-000000000013", "title": "Around the Moon", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" },
  { "book_id": "00000000-0000-0000-0000-000000000010", "title": "around the moon", "author": "00000000-0000-0000-0000-000000000000", "published_at": "1905-01-01" }
]
```