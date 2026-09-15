# `POST /loans/:id/return` 
## What it does for the client
Any member with auth api key can return a loan.
It is idempotent request (returning twice = second call is a no-op 200).

## Request
**Method:** POST
**Path:** `/loans/:id/return`
**Path parameters:** `:id` - loan_id parameter
**Headers:**
- `X-API-Key: abcdef12345`
**Body parameters:** none

`X-API-Key: abcdef12345` is a placeholder.
Authorization is described in a separate document.

## Success Response
**Status: 200**

**Response schema:**

```json
{
  "title" : "Loan",
  "type" : "object",
  "properties" : {
    "loan_id" : {
      "type": "string"
    },
    "member" : {
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
    },
    "returned_at" : {
      "type": "string",
      "format": "date"
    }
  }
}
```

## Errors
- `404` — `Loan with id:$1 undefined`

## Side effects
If the loan is still open, record the current date in `loans.returned_at`.
A second return does not change `returned_at`.
Record the user's action in the system log.

## Transaction
Start the transaction
```postgresql
BEGIN;
```
Check for the existence of the loan
```postgresql
SELECT loan_id, member, book, borrowed_at, due_at, returned_at
FROM loans
WHERE loans.loan_id = $1;
```
If empty, rollback here and error 404:
`Loan with id:$1 undefined`

If the row exists and `returned_at IS NOT NULL`:
```postgresql
COMMIT;
```
Return `200` with that row.

If the row exists and `returned_at IS NULL`, record the current date in `loans.returned_at`.
```postgresql
UPDATE loans
SET returned_at = CURRENT_DATE
WHERE loan_id = $1 AND returned_at IS NULL
RETURNING loan_id, member, book, borrowed_at, due_at, returned_at;
```
If UPDATE returns a row:
```postgresql
COMMIT;
```
Return `200` with the `RETURNING` row.

If UPDATE returns no row (another request already closed the loan), repeat the same `SELECT`, then:
```postgresql
COMMIT;
```
Return `200` with that row.

### Test fixture (not `../../seed.js`)

Shared with `POST /loans`. Rows live in [`loans-fixture.json`](./loans-fixture.json), not in this file.

Truncate the test database, then insert that JSON. Deterministic ids — no `gen_random_uuid()` in fixtures. `borrowed_at` / `due_at` values like `CURRENT_DATE - 3` are SQL expressions evaluated at insert time so the fixture does not drift.

`unseeded_ids_for_404_tests` are not inserted. `unknown_loan_id` is the `404` case.

What this fixture is built to break if the return is wrong:

- loan `…403` (Returnable Book) is open (`returned_at` is null); first return must set `returned_at` to `CURRENT_DATE`
- the same `POST` again is a no-op: `200`, `returned_at` unchanged
- `unknown_loan_id` (`…997`) is not a row → `404`

Open loans `…401` and `…402` belong to the borrow contract. Do not return them in this suite; they exist so the shared fixture stays valid for `POST /loans`.

### Expected response (`200`)

First and second return of `…403` — same body. `returned_at` is the date of the first return.

```json
{
  "loan_id": "00000000-0000-0000-0000-000000000403",
  "member": "00000000-0000-0000-0000-000000000102",
  "book": "00000000-0000-0000-0000-000000000205",
  "borrowed_at": "<CURRENT_DATE - 3>",
  "due_at": "<CURRENT_DATE + 11>",
  "returned_at": "<CURRENT_DATE>"
}
```

