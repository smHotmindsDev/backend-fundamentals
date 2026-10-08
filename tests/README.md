# Tests

Layout follows the test plan (`docs/test-plan.md`):

```
tests/unit/          pure logic, no I/O, no env file needed
tests/integration/   your code + real Postgres (never mock pg)
tests/e2e/           one flow through the running HTTP server
tests/helpers/       clock.js (frozen date), db.js (pool, truncate, fixtures)
tests/setup/         global.js: creates the *_test database, runs migrations
```

## Running

```
docker compose up -d          # same container as dev; the test DB lives beside it
npm test                      # everything, files run one at a time
npm run test:unit             # no database needed
npm run test:coverage         # lcov in coverage/, uncovered lines printed
npm run test:flake            # 10 consecutive green runs (Definition of Done)
```

`.env.test` is your `.env.development` with `POSTGRES_DB` suffixed `_test`
(see `.env.example`). The helpers refuse to truncate any other database.

## Decisions baked into the helpers

- **State reset: truncate + seed, per test.** `loadFixture(pool, 'loans')`
  truncates every table and inserts `docs/api-contracts/loans-fixture.json`
  in one transaction. Call it in `beforeEach`. Transaction-rollback isolation
  was rejected because the double-borrow test needs two connections that
  really commit.
- **Time: injected clock.** `TEST_TODAY` in `helpers/clock.js` is the frozen
  date. Fixture expressions like `CURRENT_DATE - 5` are resolved in JS against
  it, not by Postgres, so seed rows and the app's clock agree. Hand the same
  date to the app's clock in your tests.
- `date` columns are returned as `'YYYY-MM-DD'` strings (type parser set in
  `helpers/db.js`). Your app pool needs the same setting or JSON responses
  will carry timestamps instead of dates.

## What the helpers expect from the app

Nothing yet. They only need an app you can construct in a test with the test
pool and a clock, without it reading `process.env` or calling `listen` at
import time. The shape of that factory is yours to design.
