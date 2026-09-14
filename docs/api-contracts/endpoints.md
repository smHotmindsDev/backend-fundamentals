# Endpoints

## `GET /books?search=&page=` — pagination

### What it does for the client

Ділить великий обсяг даних з бази даних на менші частини (сторінки), щоб завантажувати їх порціями (по 10 рядків на сторінку).

Є можливість: 
- фільтрувати по назві книги (`search={$title}`)
- завантажувати довільну сторінку (`page={page_number}`)

### Method

`GET` — no database writes.

### Request

- **Path** — `/books?search=&page=`
- **Query / body**
  - `search=` — текст для пошуку по заголовкам (опціонально), тип String, не залежить від регістру, екрануємо спецсимволи
  - `page=` — номер сторінки (опціонально), String to Number, діапазон - всі позитивні целочислені числа від 1

### Success

- **Status** — `200`
- **Body** — JSON array:
  - **at most** 10 elements;
  - fewer than 10 is valid - означає кінець;
  - empty array is valid - означає кінець

Each element:

- `book_id` — uuid — Postgres column `books.book_id`
- `title` — string
- `available_copies` — integer
- `author` — uuid — FK; First Name and Last Name автора клієнт бере окремим запитом

### Errors
- `400` — Невалідний параметр в page= (`page=0`, `page=-1`, `page=abc`)

There is no `403`: a single shared API key has no “authenticated but not allowed” case.

### Side effects

None.

### Limits

- розмір сторінки фіксований (10, клієнт його не змінює), а `page` вибирає зсув.

### Pagination Math
`LIMIT = 10`
`OFFSET = (page - 1) * LIMIT`

### Query
```js
const LIMIT = 10;

const paginationSqlWithoutSearch = `
	SELECT books.book_id, books.title, books.available_copies, books.author
	FROM books
	ORDER BY books.title, books.book_id
	LIMIT $1 OFFSET $2;
`;

const paginationSqlWithSearch = `
	SELECT books.book_id, books.title, books.available_copies, books.author
	FROM books
	WHERE books.title ILIKE '%' || $3 || '%'
	ORDER BY books.title, books.book_id
	LIMIT $1 OFFSET $2;
`;

```
`

---

### Test fixture ( not `../../seed.js`)
Deterministic ids — no `gen_random_uuid()` in fixtures (example: `00000000-0000-0000-0000-000000000001`).

One author. Loans must satisfy FKs (`author`, `member`, `copy_id`) and the partial unique index on open loans (`copy_id` where `returned_at IS NULL`). Returned loans are enough for this report; many members are not required if every loan is returned.

```csv
title,book_id,available_copies,total_copies,published_at
Twenty Thousand Leagues,00000000-0000-0000-0000-000000000000,25,50,1905-01-01
Around the World in 80 Days,00000000-0000-0000-0000-000000000001,25,49,1905-01-01
Journey to the Centre of the Earth,00000000-0000-0000-0000-000000000002,25,48,1905-01-01
From the Earth to the Moon,00000000-0000-0000-0000-000000000003,25,47,1905-01-01
Michael Strogoff,00000000-0000-0000-0000-000000000004,25,46,1905-01-01
Five Weeks in a Balloon,00000000-0000-0000-0000-000000000005,25,45,1905-01-01
In Search of the Castaways,00000000-0000-0000-0000-000000000006,25,44,1905-01-01
Robur the Conqueror,00000000-0000-0000-0000-000000000007,25,44,1905-01-01
The Steam House,00000000-0000-0000-0000-000000000008,25,42,1905-01-01
Paris in the Twentieth Century,00000000-0000-0000-0000-000000000009,10,10,1905-01-01
around the moon,00000000-0000-0000-0000-000000000010,10,10,1905-01-01
The Green Ray,00000000-0000-0000-0000-000000000011,10,10,1905-01-01
The Mysterious Island,00000000-0000-0000-0000-000000000012,100,100,1905-01-01
Around the Moon,00000000-0000-0000-0000-000000000013,10,10,1905-01-01
```

Author FK on every book: `00000000-0000-0000-0000-000000000000`.

---

## `POST /loans`
### What it does for the client
Any member with auth api key can create an loan.
Запит ідемпотентний.

### Request
**Method:** POST
**Path:** `/loans`
**Headers:**
- `'Content-Type' : 'application/json'`
- `"Content-Length" : Buffer.byteLength(bodyData, 'utf8'),` - рахується автоматично, відносно розміру body
- `Idempotency-Key: ${idemponencyKey}` - a secure **UUID v4 (random)** builded Native JS Method (в момент, коли користувач ініціював операцію)
**Body:**
- `member` - uuid
- `book` - uuid

### Success Response

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

### Errors

- `400` — Bad Request - невідповідний Content-Type
- `404` — Resource not found - невірний ідентифікатор member
- `404` — Resource not found - невірний ідентифікатор book
- `409` — Немає вільних екземплярів
- `422` — Validation failed - невалідне тіло запиту (синтаксис, типи, обовʼязкові поля)
- `503` — Service unavailable - помилки на боці сервера

### Side effects

Создание записи в таблице Loans.
Обновление поля available_copies в таблице Books.
Запись действия пользователя в системный лог.

### Transaction
Pessimistic row-level locking within a database transaction (a constraint-based approach).
Для забезпечення ідемпотентності використовуємо Idempotency Key.

```sql
-- Start the transaction
BEGIN;

-- First operation - Check for the existence of the book 
-- if empty data, we can rollback here: 404 (`Book with id:${placeholderBookId} undefined`)
SELECT book_id, available_copies, total_copies
FROM books
WHERE book_id = $1;

-- Second operation - Check for available copies of books
-- if availableCopies < 1, we can rollback here: 409 (`Book with id:${placeholderBookId} has no copy available`)
SELECT book_copies.copy_id
FROM book_copies
LEFT JOIN loans
    ON loans.copy_id = book_copies.copy_id
        AND loans.returned_at IS NULL
WHERE book_copies.book_id = $1
  AND loans.loan_id IS NULL;

-- Third operation - create a loan
-- if fails in this operation, we can rollback: 409 ('copy already taken, conflict')
INSERT INTO loans(loan_id, member, book, copy_id, borrowed_at, due_at)
VALUES (
    gen_random_uuid(),
    $1, 
    $2, 
    $3,
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '2 week'
    );

-- Fourth operation - Decrement available copies in table "books"
UPDATE books
SET available_copies = available_copies-1
WHERE book_id = $1;      

-- Commit everything permanently
COMMIT;

-- if any fails in transaction, we can rollback

```

---

## `GET /reports/top-books`

### What it does for the client

Returns the 10 most borrowed books in the last 90 days, **inclusive** of the 90-day boundary.

Returned loans still count. The query does **not** filter on `loans.returned_at`. Popularity is the fact of a borrow, not current possession.

### Method

`GET` — no database writes.

### Request

- **Path** — `/reports/top-books`
- **Query / body** — none

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

**Inserted loan counts vs API counts are different.** Column *inserted_loans* is how many `loans` rows you write. The API returns the count **inside the 90-day window**. Steam House (42 loans at 91 days) and The Mysterious Island (100 at 100 days) therefore appear as `0`.

`borrowed_at` is the interval passed to `CURRENT_DATE - INTERVAL '<n> day'`; `-` means no loans inserted.

```csv
title,inserted_loans,borrowed_at,book_id,available_copies,total_copies,published_at
Twenty Thousand Leagues,50,30 day,00000000-0000-0000-0000-000000000000,25,50,1905-01-01
Around the World in 80 Days,49,30 day,00000000-0000-0000-0000-000000000001,25,49,1905-01-01
Journey to the Centre of the Earth,48,30 day,00000000-0000-0000-0000-000000000002,25,48,1905-01-01
From the Earth to the Moon,47,30 day,00000000-0000-0000-0000-000000000003,25,47,1905-01-01
Michael Strogoff,46,30 day,00000000-0000-0000-0000-000000000004,25,46,1905-01-01
Five Weeks in a Balloon,45,89 day,00000000-0000-0000-0000-000000000005,25,45,1905-01-01
In Search of the Castaways,44,90 day,00000000-0000-0000-0000-000000000006,25,44,1905-01-01
Robur the Conqueror,44,30 day,00000000-0000-0000-0000-000000000007,25,44,1905-01-01
The Steam House,42,91 day,00000000-0000-0000-0000-000000000008,25,42,1905-01-01
Paris in the Twentieth Century,0,-,00000000-0000-0000-0000-000000000009,10,10,1905-01-01
Around the Moon,0,-,00000000-0000-0000-0000-000000000010,10,10,1905-01-01
The Green Ray,0,-,00000000-0000-0000-0000-000000000011,10,10,1905-01-01
The Mysterious Island,100,100 day,00000000-0000-0000-0000-000000000012,100,100,1905-01-01
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

---
