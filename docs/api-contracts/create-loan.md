# `POST /loans`
## What it does for the client
Any member with auth api key can create a loan.
It is idempotent request.

## Request
**Method:** POST
**Path:** `/loans`
**Path parameters:** none
**Headers:**
- `'Content-Type' : 'application/json'`
- `"Content-Length" : Buffer.byteLength(bodyData, 'utf8'),`
- `Idempotency-Key: ${idempotencyKey}`
- `X-API-Key: abcdef12345`
**Body parameters:**
- `member` - uuid
- `book` - uuid

Use `Buffer.byteLength(bodyData, 'utf8')` to automatically determine the value based on the size of the request body.
The client generates a new UUID v4 for each logical `POST /loans` and sends it in `Idempotency-Key`. The same value is resent only when retrying that request (timeout, lost response). A second loan needs a new key.
`X-API-Key: abcdef12345` is a placeholder.
Authorization is described in a separate document.

## Success Response

**Status: 201**

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
    }
  }
}
```

## Errors
- `400` — Bad Request — invalid Content-Type
- `404` — `Member with id:$1 undefined`
- `404` — `Book with id:$1 undefined`
- `409` — `copy already taken, conflict`
- `422` — Validation failed — invalid request body (syntax, data types, required fields)
- `500` — Internal Server Error — server-side errors

## Side effects
Creating an entry in the Loans table.
Record the user's action in the system log.

## Transaction
Constraint-based approach within a database transaction (no `SELECT … FOR UPDATE`). Uniqueness is enforced by `uidx_borrowed_book_copy` and `uidx_loans_idempotency_key`.
We use an idempotency key to ensure idempotency.

Start the transaction
```postgresql
BEGIN;
```
Check for the existence of the Idempotency Key
```postgresql
SELECT loan_id, member, book, borrowed_at, due_at
FROM loans
WHERE loans.idempotency_key = $1;
```
If the query returns a row, this is a retry:
```postgresql
COMMIT;
```
Return `201` with that row.
Else, transaction continues.

Check for the existence of the member
```postgresql
SELECT member_id
FROM members
WHERE members.member_id = $1;
```
If empty, rollback here and error 404:
`Member with id:$1 undefined`

Check for the existence of the book
```postgresql
SELECT book_id
FROM books
WHERE book_id = $1;
```
If empty, rollback here and error 404:
`Book with id:$1 undefined`

Check for available copies of books
```postgresql
SELECT book_copies.copy_id
FROM book_copies
    LEFT JOIN loans
        ON loans.copy_id = book_copies.copy_id
        AND loans.returned_at IS NULL
WHERE book_copies.book_id = $1
  AND loans.loan_id IS NULL
ORDER BY book_copies.copy_id;
```
If empty data, we have rollback here and error 409 :
`copy already taken, conflict`

Create the loan
```postgresql
INSERT INTO loans(loan_id, member, book, copy_id, borrowed_at, due_at, idempotency_key)
VALUES (
    gen_random_uuid(),
    $1,
    $2,
    $3,
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '2 week',
    $4
)
RETURNING loan_id, member, book, borrowed_at, due_at;
```
If INSERT succeeds:
```postgresql
COMMIT;
```
Return `201` with the `RETURNING` row.

If error.code === '23505' and error.constraint === 'uidx_borrowed_book_copy', we have rollback here and error 409:
`copy already taken, conflict`

If error.code === '23505' and error.constraint === 'uidx_loans_idempotency_key', we have rollback here (the transaction is aborted; do not `COMMIT` it), then:
```postgresql
SELECT loan_id, member, book, borrowed_at, due_at
FROM loans
WHERE idempotency_key = $1;
```
Return `201` with that row.
