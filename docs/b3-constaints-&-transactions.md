# B3. Constraints & transactions
## Task
**Constraints:**
- a member can't borrow the same book copy twice simultaneously (partial unique index — nice puzzle),
- loans must reference existing members/books (FKs),
- due_at > borrowed_at (CHECK).

**Transaction exercise:**
- "borrow a book" = check availability + insert loan + decrement available copies.

**Implement, then break it:**
- run two parallel borrow requests for the last copy without proper locking and observe the double-borrow.

**Fix with SELECT … FOR UPDATE (or a constraint-based approach — discuss both).**

🧠 Manual-only: everything here, including causing the race.

## Constraints
### **a member can't borrow the same book copy twice simultaneously (partial unique index — nice puzzle)**
#### Initial plan
The schema originally called for a new index — idx__books_with_available_copies (book_id, available_copies) WHERE available_copies > 0 -- partial index.
```postgresql
CREATE UNIQUE INDEX uidx_books_with_available_copies
ON books(book_id, available_copies)
WHERE available_copies > 0
```

#### Implementation and existing limitations
But now I realize this isn't enough — I need to create an index on `loans` that links members and books:
- the "event" of borrowing happens in the `loans` table
- the combination of `member, book` columns should be non-unique if the same copy is issued twice at once — but you could also take two identical books, and that's not forbidden by this condition (though it would be convenient if it were)
- the `returned_at` column shows that a loan is still active (not returned)
- a partial index works via a `WHERE` clause on the column/condition that makes a row "active"

```postgresql
CREATE UNIQUE INDEX uidx_member_with_book_copy
ON loans(member, book)
WHERE returned_at IS NULL
```
According to this index — one member cannot have two simultaneous active loans of the same book.

#### Resolving the existing limitations of the implementation
Something more — namely, adding a constraint on borrowing a specific book *copy* — becomes possible only by changing the data schema.

Need to add a new `book_copies` table with its own `copy_id`:
```postgresql
CREATE TABLE IF NOT EXISTS book_copies (
    copy_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id uuid NOT NULL,
    FOREIGN KEY (book_id) REFERENCES books(book_id)
)
```

Populate `book_copies` with data (based on `books.total_copies`).

Update `loans`:
```postgresql
ALTER TABLE loans
    ADD COLUMN copy_id uuid    
```

Backfill `loans.copy_id` for existing rows (UPDATE).

Update `loans` again:
```postgresql
ALTER TABLE loans
    ALTER COLUMN copy_id SET NOT NULL,
    ADD CONSTRAINT fk_book_copy_id
    FOREIGN KEY (copy_id)
    REFERENCES book_copies(copy_id);
```

Check how the backfill worked out:
```postgresql
-- check: is any copy_id assigned to two active loans at once
SELECT copy_id, COUNT(*)
FROM loans
WHERE returned_at IS NULL
GROUP BY copy_id
HAVING COUNT(*) > 1;
```

Create the index:
```postgresql
DROP INDEX uidx_member_with_book_copy;

CREATE UNIQUE INDEX uidx_borrowed_book_copy
ON loans(copy_id)
WHERE returned_at IS NULL
```

Move on to verifying the correctness of the protection via transactions.

For the future:
```postgresql
ALTER TABLE loans 
DROP COLUMN book;
```

### **loans must reference existing members/books (FKs)**
- already covered by the schema and implemented in `/migrations/0004_loans.sql`

### **due_at > borrowed_at (CHECK).**
- already covered by the schema and implemented in `/migrations/0004_loans.sql`

## Transaction

**"borrow a book" = check availability + insert loan + decrement available copies.**

The naive implementation wraps these three steps in a single `BEGIN ... COMMIT` block: read `available_copies` and a free `copy_id`, `INSERT` into `loans`, then `UPDATE books SET available_copies = available_copies - 1`. Each step is `await`-ed sequentially inside one transaction, and any failure triggers a full `ROLLBACK` — this is what makes the operation atomic (all three steps succeed together, or none of them persist).

Run naively — without any locking — against a book with exactly one free copy, two parallel requests both read the same `available_copies` and the same free `copy_id` before either has committed. Both proceed to `INSERT INTO loans`, and the second one fails with a `duplicate key value violates unique constraint "uidx_borrowed_book_copy"` (SQLSTATE `23505`). This is the double-borrow: not because the constraint failed, but because both transactions read the same *stale, not-yet-committed* state and acted on it independently — the classic read-then-write race under `READ COMMITTED` isolation.

Two fixes were implemented and compared. **`SELECT ... FOR UPDATE`** on the `books` row turns the two transactions into a queue: the second transaction blocks until the first commits, then reads the now-updated state — no conflict ever reaches `INSERT`, at the cost of one transaction waiting. **Constraint-based (optimistic)**: no lock is taken; both transactions proceed freely, and the unique index (`uidx_borrowed_book_copy`) itself rejects the losing `INSERT` with `23505`, caught explicitly and turned into `{result: false, message: 'copy already taken, conflict'}` instead of an unhandled exception. This trades a guaranteed-but-slower single pass (`FOR UPDATE`) for a fast response with an explicit conflict signal — but without a retry loop around it, a transaction that loses the race is refused outright even if another copy of the same book was actually free at that moment. Both approaches were verified empirically: with `Promise.all` firing two parallel requests at a book with one remaining copy, `FOR UPDATE` produces one success and one clean rejection with no exception ever reaching the constraint, while the constraint-based version produces one success and one caught `23505`, confirmed against the database (`available_copies` decremented by exactly one, exactly one active loan row).