// Smoke test for the test infrastructure itself: DB reachable, migrations
// applied, fixtures load and dates resolve. Not one of the project's "first
// tests of each kind" — those are yours. Delete this file once your own
// integration tests exercise the same helpers.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestPool, loadFixture, materializeFixture, readFixture, resolveDate, truncateAll } from './helpers/db.js';
import { TEST_TODAY, addDays } from './helpers/clock.js';

let pool;
before(() => { pool = createTestPool(); });
after(() => pool.end());

test('resolveDate understands every form used in the fixtures', () => {
    assert.equal(resolveDate(null), null);
    assert.equal(resolveDate('1905-01-01'), '1905-01-01');
    assert.equal(resolveDate('CURRENT_DATE'), TEST_TODAY);
    assert.equal(resolveDate('CURRENT_DATE - 5'), addDays(TEST_TODAY, -5));
    assert.equal(resolveDate('CURRENT_DATE + 9'), addDays(TEST_TODAY, 9));
    assert.equal(resolveDate("CURRENT_DATE - INTERVAL '90 day'"), addDays(TEST_TODAY, -90));
    assert.throws(() => resolveDate('yesterday'));
});

test('materializeFixture expands inserted_loans into returned loans', async () => {
    const rows = materializeFixture(await readFixture('top-books'));
    assert.equal(rows.books.length, 13);
    assert.equal(rows.loans.length, 515); // sum of inserted_loans
    assert.ok(rows.loans.every((l) => l.returned_at !== null), 'all generated loans are returned');
    assert.equal(new Set(rows.loans.map((l) => l.loan_id)).size, 515, 'loan ids unique');
    assert.equal(new Set(rows.loans.map((l) => l.idempotency_key)).size, 515, 'idempotency keys unique');
    assert.ok(!('inserted_loans' in rows.books[0]), 'generator spec is not a column');
});

test('test database is reachable and fully migrated', async () => {
    const { rows } = await pool.query('SELECT current_database() AS db, COUNT(*)::int AS n FROM schema_migration GROUP BY 1');
    assert.match(rows[0].db, /_test$/);
    assert.equal(rows[0].n, 24);
});

for (const name of ['pagination', 'top-books', 'loans']) {
    test(`fixture "${name}" loads into Postgres`, async () => {
        const fixture = await loadFixture(pool, name);
        const expected = materializeFixture(fixture);
        for (const table of ['authors', 'members', 'books', 'book_copies', 'loans']) {
            const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM ${table}`);
            assert.equal(rows[0].n, expected[table].length, `${name}: row count in ${table}`);
        }
    });
}

test('date columns come back as YYYY-MM-DD strings and match the frozen clock', async () => {
    await loadFixture(pool, 'loans');
    const { rows } = await pool.query(`SELECT borrowed_at, due_at FROM loans WHERE loan_id = $1`, ['00000000-0000-0000-0000-000000000403']);
    assert.deepEqual(rows[0], { borrowed_at: addDays(TEST_TODAY, -3), due_at: addDays(TEST_TODAY, 11) });
});

test('truncateAll empties every table', async () => {
    await truncateAll(pool);
    const { rows } = await pool.query('SELECT (SELECT COUNT(*) FROM loans) + (SELECT COUNT(*) FROM books) AS n');
    assert.equal(Number(rows[0].n), 0);
});
