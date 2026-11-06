# Backlog

## `POST /loans` — additional edge cases

Ideas generated after the test plan was written (README: 🤖 AI-OK "generating *additional* edge-case ideas"). Each item still needs a decision and a test written by hand.

### A. Gap against `test-plan.md`

- [ ] **`requestId` in error bodies.** `test-plan.md` (Integration, "Error bodies") requires `requestId` to be a UUID v4 equal to the `X-Request-Id` header. No error test in `loans.test.js` asserts it.

### B. Contract is silent — decide in `create-loan.md` first, then test

- [x] **Same `Idempotency-Key`, different body.** Boris with Anna's key got `201` with Anna's loan. Replay as is, or reject (`409` / `422` "key reused with different payload")?
  - **Closed in #22.** Rejected with `422` `validation_error` `Idempotency-Key already used with a different member or book`, no `details` (`create-loan.md`, draft-ietf-httpapi-idempotency-key-header). Tested sequentially (other book, other member) and in a race.
- [ ] **Retry with a key after a failed request.** First call `409` (no copy) → rolled back, key not stored. Copy is returned, client retries with the same key → `201`. Intended, or should failed responses be remembered too?
- [ ] **Same member borrows a second copy of the same book** (new key, Multi-Copy Book). Today `201`. Is there a one-copy-per-member rule?
- [ ] **Book exists but has zero copies.** Today `409 copy already taken, conflict`, although nothing was taken. Which status and message?
- [ ] **Unknown fields in the body** (`{member, book, foo: 1}`). Schema is not strict, extras are silently stripped; the `unrecognized_keys → unknown_field` mapping in `src/routes/loans.js` is unreachable. Ignore or `422 unknown_field`?

### C. Defined behaviour, not tested

- [ ] **A returned loan frees its copy.** Every fixture loan has `returned_at: null`, so `AND loans.returned_at IS NULL` in the available-copies JOIN is never exercised — removing it keeps all tests green. Case: the only copy of a book has a returned loan → `201`. (Natural follow-up once `POST /loans/:id/return` exists: return `…403`, then borrow Returnable Book.)
- [ ] **Unknown member and unknown book at once.** Which `404` wins? Today member (order of checks). A test pins the order as contract.
- [ ] **Several validation errors at once** (bad `member`, bad `book`, bad `Idempotency-Key`). Code collects all into `details`; tests only ever break one field. Assert all three entries are returned.
- [ ] **Body is not an object:** malformed JSON (`{"member":`), `[]`, `null`, a string. Malformed JSON fails in `express.json()` before route code — check the error handler returns `422` `validation_error` with `details[].field = "body"` (`api-error-envelope.md`, README A4), not `500`.
- [ ] **Uppercase UUID.** Does `z.uuidv4()` accept it? `idempotency_key` is a `uuid` column, so `ABC…` and `abc…` are the same key for Postgres — repeat a call with the key in a different case.
  - **Partly covered in #22.** `z.uuidv4()` accepts uppercase and keeps the case; `member` and `book` are compared case-insensitively. Tested: a retry where key, `member` and `book` are uppercase in both calls returns `201`. Not tested yet: the key in a different case between the first call and the retry.

### D. Uncovered lines

- [x] **`src/routes/loans.js` 176–178** (line numbers before #22) — the `23505` branch on `uidx_loans_idempotency_key` never ran (the second request found the row via `findLoanByIdempotencyKey` first). README requires every uncovered line to be justified: either argue "not deterministically reachable because …", or find a way to force the race (🧠 Manual-only: concurrency).
  - **Closed in #22.** Reachable: same key, different book, both requests pass the key lookup before either commits. It returned someone else's loan with `201`, and the same-body race returned `409`. Fixed (both `23505` branches check the key: same body `201`, different body `422`) and covered by race tests that hold both calls after the key lookup.
