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

