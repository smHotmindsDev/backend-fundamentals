# Backlog

## `POST /loans` — additional edge cases

Ideas generated after the test plan was written (README: 🤖 AI-OK "generating *additional* edge-case ideas"). Each item still needs a decision and a test written by hand.

### A. Gap against `test-plan.md`

- [ ] **`requestId` in error bodies.** `test-plan.md` (Integration, "Error bodies") requires `requestId` to be a UUID v4 equal to the `X-Request-Id` header. No error test in `loans.test.js` asserts it.

### B. Contract is silent — decide in `create-loan.md` first, then test

- [ ] **Same `Idempotency-Key`, different body.** Today Boris with Anna's key gets `201` with Anna's loan. Replay as is, or reject (`409` / `422` "key reused with different payload")?
- [ ] **Retry with a key after a failed request.** First call `409` (no copy) → rolled back, key not stored. Copy is returned, client retries with the same key → `201`. Intended, or should failed responses be remembered too?
- [ ] **Same member borrows a second copy of the same book** (new key, Multi-Copy Book). Today `201`. Is there a one-copy-per-member rule?
- [ ] **Book exists but has zero copies.** Today `409 copy already taken, conflict`, although nothing was taken. Which status and message?
- [ ] **Unknown fields in the body** (`{member, book, foo: 1}`). Schema is not strict, extras are silently stripped; the `unrecognized_keys → unknown_field` mapping in `src/routes/loans.js` is unreachable. Ignore or `422 unknown_field`?

### C. Defined behaviour, not tested

- [ ] **A returned loan frees its copy.** Every fixture loan has `returned_at: null`, so `AND loans.returned_at IS NULL` in the available-copies JOIN is never exercised — removing it keeps all tests green. Case: the only copy of a book has a returned loan → `201`. (Natural follow-up once `POST /loans/:id/return` exists: return `…403`, then borrow Returnable Book.)
- [ ] **Unknown member and unknown book at once.** Which `404` wins? Today member (order of checks). A test pins the order as contract.
- [ ] **Several validation errors at once** (bad `member`, bad `book`, bad `Idempotency-Key`). Code collects all into `details`; tests only ever break one field. Assert all three entries are returned.
- [ ] **Body is not an object:** malformed JSON (`{"member":`), `[]`, `null`, a string. Malformed JSON fails in `express.json()` before route code — check the error handler returns `400`, not `500`.
- [ ] **Uppercase UUID.** Does `z.uuidv4()` accept it? `idempotency_key` is a `uuid` column, so `ABC…` and `abc…` are the same key for Postgres — repeat a call with the key in a different case.

### D. Uncovered lines

- [ ] **`src/routes/loans.js` 139–141** — the `23505` branch on `uidx_loans_idempotency_key` never runs (the second request finds the row via `findByIdempotencyKey` first). README requires every uncovered line to be justified: either argue "not deterministically reachable because …", or find a way to force the race (🧠 Manual-only: concurrency).
