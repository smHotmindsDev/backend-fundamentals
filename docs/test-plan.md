# Test plan

What is tested at which level, and why.

One behaviour = one row. Fill before writing tests.
## Unit

Pure logic, no I/O. pure logic in isolation, no I/O. Fast (ms), many.

Here: overdue calculation, pagination math, rate-limiter logic, validation schemas.

| What | Why this level | Happy path | Error / edge |  
|-|---|---|---|  
| | | | |  
| | | | |  
| | | | |  

## Integration

Own code + real Postgres. Do not mock `pg`.

Here: every endpoint against a real test Postgres (Docker), repositories/queries, the borrow transaction.

| What                                                                          | Why this level                                                            | Happy path                                                                      | Error / edge                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /books?search=&page=` — pagination                                       |                                                                           |                                                                                 |                                                                                                                                                                                                                 |
| `POST /loans` — the transactional borrow                                      |                                                                           |                                                                                 |                                                                                                                                                                                                                 |
| `POST /loans/:id/return` — idempotent                                         |                                                                           |                                                                                 |                                                                                                                                                                                                                 |
| `GET /reports/top-books` — топ 10 книг за останні 90 днів включно | Агрегація по реальних рядках у Postgres; мок `pg` нічого не доведе | Seed у test DB (не `seed.js`), відносні дати від `CURRENT_DATE`. Очікувана відповідь — JSON нижче (лічильник **у вікні**, не кількість вставлених рядків). | Порожня БД → `[]`; немає `Authorization` → 401; ключ не збігається → 401 |
| Auth-lite: single API key via header + per-key rate limit (in-memory is fine) | Перевіряє наявність та валідність API ключа в Header запитів.             | правильний ключ - 200                                                           | немає API key - 401;<br>невалідний API key - 401;                                                                                                                                                               |

Expected body for `GET /reports/top-books` (HTTP 200), computed from the fixture **after** applying `borrowed_at >= CURRENT_DATE - 90 days`. Inserted loans outside the window count as 0 (Steam House 42 @ 91d, Mysterious Island 100 @ 100d). Tie 44/44: Castaways `…0006` before Robur `…0007`. The two extra slots to reach 10 are the lowest `book_id` zeros: Steam House, then Paris. Around the Moon, The Green Ray, and The Mysterious Island are not in the list.

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
|---|---|---|---|  
| | | | |
