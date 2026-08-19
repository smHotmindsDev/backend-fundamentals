# Training Project: Backend & Database Fundamentals

**Purpose:** Build a solid backend and database foundation — HTTP, the event loop, raw SQL, transactions, and performance thinking — as a standalone training project where mistakes are cheap.

**Format:** One small app + a series of standalone practice tasks. Duration: 3 weeks.

## Schedule

**Start: Wednesday, 19 August 2026.** Daily focused time: ~2–4 hours. Fridays end with a review session with the mentor.

**Week 1 — Part A: Backend mechanics (Wed 19 Aug – Fri 28 Aug)**
- Wed 19 – Thu 20 Aug: A1 — HTTP from scratch + `docs/http.md`
- Fri 21 Aug: A2 — framework + hand-written middlewares · **review #1**
- Mon 24 – Tue 25 Aug: A3 — event loop lab + `docs/event-loop.md`
- Wed 26 – Thu 27 Aug: A4 — errors, validation, config
- Fri 28 Aug: **review #2** — event-loop doc defended, Part A merged

**Week 2 — Part B: SQL (Mon 31 Aug – Fri 4 Sep)**
- Mon 31 Aug: schema on paper → mentor review → hand-written migrations + seed
- Tue 1 – Wed 2 Sep: B1 — query drills 1–6 (Tue), 7–10 (Wed)
- Thu 3 Sep: B2 — indexing lab (morning) · B3 — constraints & the double-borrow race (afternoon; carry into Fri morning if needed — this one is not rushed)
- Fri 4 Sep: B4 — N+1 lab · **review #3** — drills + race demo

**Week 3 — Parts C & D: API + tests (Mon 7 Sep – Fri 11 Sep)**
- Mon 7 Sep: written test plan (first!) + test infra: test DB, runner, CI
- Tue 8 – Wed 9 Sep: endpoints built test-first or test-alongside — borrow/return with the concurrency test (Tue), books/search/reports (Wed)
- Thu 10 Sep: coverage pass — error paths, time-frozen overdue tests, flake hunt (10 consecutive green runs)
- Fri 11 Sep: buffer + final PR against the Definition of Done · **final review**

Slippage rule: if a task overruns by more than a day, tell the mentor the same day — the schedule bends, silence doesn't.

**The app:** **"Library API"** — a plain REST API for a small library: books, authors, members, loans. Boring domain on purpose: zero product distraction, 100% focus on mechanics. No frontend at all — Postman/HTTP files only. This is deliberate: your daily work is frontend, so here we remove it entirely.

**Stack:** Node.js + TypeScript + Fastify/Express, **raw Postgres via `pg` driver — no ORM in this project.** You must feel SQL directly; ORMs come later, and you'll then understand what they abstract.

## How to use AI during this project (read first)

AI (Claude, Copilot, etc.) is allowed — this is how modern engineers work. But the goal is *your* knowledge, so the rule is:

> **AI for leverage on things you already understand. Your own brain for things you're here to learn.**

Tasks below are marked:

- **🤖 AI-OK** — boilerplate, config syntax, lookups, rubber-ducking. Use AI freely.
- **🧠 Manual-only** — the learning core. Write it yourself first. You may ask AI to *review* your finished work or *explain concepts*, but never to generate the solution.

**Global rules:**
1. Never paste an error into AI before spending 15 minutes reading it yourself. State your own hypothesis first.
2. AI-generated code you don't fully understand may not be committed. If you can't explain every line in review, it gets reverted.
3. Asking AI "explain why X works this way" is always allowed and encouraged.
4. Design decisions (schema, API shape, locking strategy) are made by you on paper *before* touching AI.
5. **All SQL drills in Part B are 🧠 Manual-only, no exceptions.** AI may explain a concept (e.g., "how do window functions work"), never write or fix the query. Seed-data generation scripts are the only 🤖 AI-OK part of Part B.

---

## Git workflow (required throughout)

This project is also practice for professional version control. Rules:

**Branching:**
- `main` is protected — never commit to it directly, even solo.
- One branch per task, named `<type>/<part>-<short-name>`:
  - `feat/a2-middleware`, `feat/b3-borrow-transaction`, `chore/a0-project-setup`, `docs/a3-event-loop`, `fix/b4-n-plus-one`
- Branch from fresh `main`, keep branches short-lived (1–3 days max). If a task drags, split it.
- Merge via Pull Request only — even though the reviewer is your mentor, write the PR like a stranger will read it: what/why, how to test, any open questions.
- Rebase your branch on `main` before opening the PR (learn `git rebase`, resolve at least one conflict during the project — if none happens naturally, the mentor will create one).

**Commits — Conventional Commits format:**
```
<type>(<scope>): <imperative summary, ≤72 chars>

Optional body: the WHY, not the what.
```
- Types: `feat`, `fix`, `docs`, `test`, `chore`, `refactor`, `perf`.
- Examples:
  - `feat(loans): add transactional borrow with FOR UPDATE lock`
  - `perf(loans): add composite index on (member_id, returned_at)`
  - `docs(event-loop): write up blocking experiment results`
- Atomic commits: one logical change each. "WIP" and "fixes" commits get squashed before the PR (`git rebase -i` — learn it here).
- The experiment tasks (A3, B2, B3) must keep the *broken* version in history: commit the naive/racy implementation first, then the fix as a separate commit. The diff between them **is** the lesson.
- Never commit: `.env`, `node_modules`, generated data dumps. Write the `.gitignore` in the first commit.

**Definition of Done addition:** `git log --oneline` reads as a coherent story of the project; any commit can be understood without opening the diff.

---

## Part A — Backend mechanics (week 1)

### A1. HTTP from scratch
Before any framework: create a server with Node's bare `http` module.
- Handle two routes manually, parse query string manually, set headers manually, return JSON manually.
- Inspect a raw request with `curl -v`: what are the actual bytes? Headers vs body, status line.
- **🧠 Manual-only:** the whole task — bare `http` module code and the doc. AI may explain header semantics.
- **Deliverable:** `docs/http.md` — your explanation of what a request physically is, what headers like `Content-Type`, `Content-Length`, `Cache-Control` do.

### A2. Framework + middleware concept
Rebuild the same two routes in Fastify/Express.
- Write three middlewares **by hand**: request logger, error handler, fake auth (checks a header token).
- Understand the onion: draw the request's path through middleware layers.
- **Review question:** what happens if a middleware forgets to call `next()` / return?
- **🤖 AI-OK:** framework setup boilerplate. **🧠 Manual-only:** the three middlewares.

### A3. The event loop lab
Small experiments, results written down:
1. Route that does `JSON.parse` of a 100MB string vs a route that `await`s a 5s timer. Hit both with parallel requests. Which blocks the whole server? Why?
2. `setTimeout(fn, 0)` vs `setImmediate` vs `process.nextTick` vs a resolved promise — predict the order, then run it.
3. Read a big file with `readFileSync` vs streams inside a request handler; measure impact on other requests.
- **Deliverable:** `docs/event-loop.md` in your own words. This doc gets reviewed hard — it's the single most important backend concept for a frontend developer.
- **🧠 Manual-only:** predictions before running, the experiments, and the writeup. Concept explanations from AI are welcome *after* your own predictions.

### A4. Errors, validation, config
- Zod validation on all inputs; malformed JSON → clean 422, never a crash.
- Central error handler: operational errors (404, validation) vs programmer errors (bugs) — different handling, different logging.
- Env config validated at boot; server refuses to start with missing config.
- Process-level safety: what happens on an unhandled promise rejection? Make it crash loudly, then discuss why crashing is correct.
- **🤖 AI-OK:** Zod syntax reference. **🧠 Manual-only:** operational-vs-programmer error design, boot validation logic.

---

## Part B — SQL, no training wheels (week 2)

Postgres in Docker. Schema for the library: `authors`, `books`, `members`, `loans` (a loan = member borrowed a book copy, with `borrowed_at`, `due_at`, `returned_at` nullable).

Design the schema first on paper; your mentor reviews it; then write the migration SQL **by hand** (plain `.sql` files + a tiny runner script — that's the whole migration lesson). **🧠 Manual-only**, including the runner script.

### B1. Query drills (all manual, all reviewed)
Seed with generated data (seed script is 🤖 AI-OK: ~50k books, 10k members, 500k loans). Then, in raw SQL, all 🧠 Manual-only:

1. All books by a given author, newest first. *(basic JOIN + ORDER BY)*
2. Members who currently hold overdue books. *(JOIN + WHERE on nullable column + date logic)*
3. Top 10 most borrowed books of the last 90 days. *(GROUP BY + COUNT + LIMIT)*
4. Authors who have never been borrowed. *(LEFT JOIN … IS NULL vs NOT EXISTS — write both, compare plans)*
5. Each member's currently borrowed count, including zeroes. *(LEFT JOIN + GROUP BY pitfalls)*
6. Books borrowed more than average. *(subquery)*
7. Per-month loan counts for the last year, months with zero included. *(generate_series — a taste of real reporting SQL)*
8. For each member: their most recent loan. *(the classic top-1-per-group — try `DISTINCT ON`, then a window function `ROW_NUMBER()`, compare)*
9. Running total of loans per day over a month. *(window function SUM OVER)*
10. Full-text-ish search: books by title fragment, case-insensitive — then discuss why `LIKE '%x%'` can't use a normal index.

Each drill: query + one-sentence explanation of what the plan does. Drills 4, 8, 10 include `EXPLAIN ANALYZE` reading.

### B2. Indexing lab
- Run drill #2 on the 500k-loan table without indexes. Note the time and the seq scan in the plan.
- Add the right index(es). Note again. Write the before/after.
- Deliberately add a *useless* index and show the planner ignoring it — indexes aren't magic dust.
- Composite index column order: demonstrate when (member_id, returned_at) works and (returned_at, member_id) doesn't for a given query.

### B3. Constraints & transactions
- Constraints: a member can't borrow the same book copy twice simultaneously (partial unique index — nice puzzle), loans must reference existing members/books (FKs), `due_at > borrowed_at` (CHECK).
- Transaction exercise: "borrow a book" = check availability + insert loan + decrement available copies. Implement, then break it: run two parallel borrow requests for the last copy *without* proper locking and observe the double-borrow. Fix with `SELECT … FOR UPDATE` (or a constraint-based approach — discuss both).
- **This exercise is the crown jewel of this project.** Race conditions clicking = backend thinking unlocked.
- **🧠 Manual-only:** everything here, including causing the race.

### B4. N+1 lab
- Endpoint: list 50 members with their current loans. First implement it the naive way (1 query for members + 1 per member). Log query count.
- Fix with a JOIN or a two-query batch. Compare timings.
- Connect it forward: "this is what ORMs do to you silently."
- **🧠 Manual-only:** both versions and the comparison.

---

## Part C — Glue it together (week 3)

Turn the drills into a real API:

- `GET /books?search=&page=` — pagination (LIMIT/OFFSET, then discuss keyset pagination and why OFFSET 100000 hurts).
- `POST /loans` — the transactional borrow, with proper 409 on conflict.
- `POST /loans/:id/return` — idempotent (returning twice = second call is a no-op 200, not an error — discuss why).
- `GET /reports/top-books` — the aggregation drill as an endpoint, response time budget: 200ms on full dataset.
- Auth-lite: single API key via header + per-key rate limit (in-memory is fine). Full user authentication is out of scope here.
- Structured logging with request IDs.

**🤖 AI-OK:** logging library setup, HTTP-file/Postman collection scaffolding. **🧠 Manual-only:** the transactional borrow endpoint, idempotency logic, pagination design and the keyset discussion, rate-limiter logic.

---

## Part D — Testing fundamentals (runs alongside Part C)

The project is complete only when the code is fully covered with tests. This section is both a guide and the completion gate.

### The test pyramid (know it, apply it)

- **Unit tests** — pure logic in isolation, no I/O. Fast (ms), many.
  Here: overdue calculation, pagination math, rate-limiter logic, validation schemas.
- **Integration tests** — your code + a real database. Slower, fewer.
  Here: every endpoint against a real test Postgres (Docker), repositories/queries, the borrow transaction.
- **E2E** — full flows through the running HTTP server.
  Here: one flow is enough — create member → borrow → return → verify report.

Rule of thumb: if a test needs the DB just to check an `if`, it should be a unit test. If a test mocks the DB to test a query — it tests nothing; make it an integration test.

### Non-negotiable testing rules

1. **Real database in integration tests.** Never mock `pg`. Use a dedicated test DB in Docker; each test starts from a known state (truncate + seed, or transaction rollback per test — pick one, understand the trade-off).
2. **Test behavior, not implementation.** Assert on responses and DB state, not on "function X was called".
3. **Every bug found during development gets a regression test** before the fix is committed. Fix commit = test + fix together.
4. **Failure cases are first-class citizens:** malformed body → 422, missing API key → 401, borrowing an unavailable book → 409, unknown ID → 404. Each endpoint's error paths are tested, not just the happy path.
5. **The concurrency test:** the double-borrow race from B3 must have an automated test — two parallel borrow requests for the last copy, exactly one succeeds. If you can test a race, you can test anything.
6. **Deterministic tests:** no sleeps, no reliance on wall-clock time (inject/freeze time for overdue logic), no test depending on another test's leftovers. A flaky test is a bug.
7. Tests run in CI (GitHub Action) on every PR — red CI blocks merge.

### What "fully covered" means here

Not a coverage percentage worshipped for its own sake — but:
- Every endpoint: happy path + every distinct error path.
- Every SQL-drill query that made it into the API: at least one test with known seed data and a hand-calculated expected result (the top-books report must match numbers you computed yourself on paper from the seed).
- All pure logic: branch-complete (this will naturally land near 100% for those modules).
- The B3 race and B4 N+1 fix: each locked in by a test.
- Coverage report generated in CI; you must be able to justify every uncovered line ("unreachable defensive branch" is an acceptable answer if argued; "didn't get to it" is not).

**🤖 AI-OK:** test-runner and CI configuration, coverage tooling setup, generating *additional* edge-case ideas after your own test plan is written.
**🧠 Manual-only:** the test plan (write it first: what is unit vs integration vs E2E and why), the first tests of each kind, the concurrency test, time-freezing design for overdue logic.

---

**Definition of Done (whole project):**
- All drills reviewed and merged via PRs with clean history.
- The double-borrow race is demonstrated *and* fixed, with the automated concurrency test proving it.
- `docs/event-loop.md` and the indexing before/after doc are solid.
- API endpoints meet the response-time budget on the 500k-row dataset.
- Full test suite green in CI, zero flakes across 10 consecutive runs, coverage report with every uncovered line justified.
- A written test plan exists explaining what is tested at which level and why.

The project is complete when the mentor approves the final PR against this list.
