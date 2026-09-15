// Test-database helpers: pool, truncate, fixture loading.
//
// Guard: every function that writes refuses to run unless the database
// name ends with `_test`. The dev database holds the 500k-row seed.

import { Pool, types } from 'pg';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { TEST_TODAY, addDays } from './clock.js';

const FIXTURE_DIR = path.resolve('docs/api-contracts');
const TABLES_IN_INSERT_ORDER = ['authors', 'members', 'books', 'book_copies', 'loans'];

// Return `date` columns as 'YYYY-MM-DD' strings instead of JS Date objects.
// pg's default parses them in local time, which is an off-by-one bug waiting
// to happen. (Your app pool will want the same setting.)
types.setTypeParser(types.builtins.DATE, (v) => v);

export function testDbConfig(env = process.env) {
    const database = env.POSTGRES_DB;
    if (!database || !database.endsWith('_test')) {
        throw new Error(
            `Refusing to touch database "${database}": test database names must end with "_test". ` +
            `Check .env.test (POSTGRES_DB).`,
        );
    }
    return {
        user: env.POSTGRES_USER,
        password: env.POSTGRES_PASSWORD,
        host: env.POSTGRES_HOST ?? 'localhost',
        port: Number(env.POSTGRES_PORT ?? 5432),
        database,
    };
}

export function createTestPool(env = process.env) {
    return new Pool({ ...testDbConfig(env), max: 10 });
}

/** Empty every table. Fast on the tiny fixtures; run it before each test. */
export async function truncateAll(pool) {
    testDbConfig(); // guard
    await pool.query(`TRUNCATE ${TABLES_IN_INSERT_ORDER.join(', ')} RESTART IDENTITY CASCADE`);
}

// ---- fixture dates ---------------------------------------------------------
//
// Fixtures write dates as SQL-looking expressions relative to CURRENT_DATE.
// We resolve them in JS against `today` (default TEST_TODAY) so the seed
// lines up with the app's injected clock, not with the DB server's clock.
//
// Accepted forms:
//   null | "YYYY-MM-DD" | "CURRENT_DATE" | "CURRENT_DATE - 5"
//   "CURRENT_DATE + 9" | "CURRENT_DATE - INTERVAL '30 day'"

const RELATIVE = /^CURRENT_DATE(?:\s*([+-])\s*(?:(\d+)|INTERVAL\s*'(\d+)\s*days?'))?$/i;

export function resolveDate(value, today = TEST_TODAY) {
    if (value === null || value === undefined) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const m = RELATIVE.exec(value.trim());
    if (!m) throw new Error(`Fixture date not understood: ${JSON.stringify(value)}`);
    const [, sign, plain, interval] = m;
    const n = Number(plain ?? interval ?? 0);
    return addDays(today, sign === '-' ? -n : n);
}

// ---- fixture loading -------------------------------------------------------

export async function readFixture(name) {
    const file = path.join(FIXTURE_DIR, `${name}-fixture.json`);
    return JSON.parse(await readFile(file, 'utf8'));
}

// Deterministic ids for generated loans (top-books fixture): the fixture
// reserves 0000…0000 – …0299 for hand-written rows, generated ones live in
// their own uuid "block" so they can never collide with them.
function generatedId(block, bookIndex, i) {
    const tail = (bookIndex * 1_000_000 + i).toString(16).padStart(12, '0');
    return `00000000-0000-0000-${block}-${tail}`;
}

/**
 * Turn a fixture JSON into concrete rows. Pure: no DB access, easy to test.
 * Handles the `inserted_loans` generator spec from top-books-fixture.json:
 * that many *returned* loans per book, all on the book's single copy.
 */
export function materializeFixture(fixture, { today = TEST_TODAY } = {}) {
    const rows = {
        authors: fixture.authors ?? [],
        members: fixture.members ?? [],
        books: [],
        book_copies: fixture.book_copies ?? [],
        loans: [],
    };

    for (const [bookIndex, book] of (fixture.books ?? []).entries()) {
        const { inserted_loans, borrowed_at, ...columns } = book;
        rows.books.push(columns);

        if (!inserted_loans) continue;
        const member = rows.members[0];
        const copy = rows.book_copies.find((c) => c.book_id === book.book_id);
        if (!member || !copy) {
            throw new Error(`inserted_loans for ${book.book_id} needs one member and one book copy in the fixture`);
        }
        const borrowed = resolveDate(borrowed_at, today);
        for (let i = 0; i < inserted_loans; i++) {
            rows.loans.push({
                loan_id: generatedId('0001', bookIndex, i),
                member: member.member_id,
                book: book.book_id,
                copy_id: copy.copy_id,
                borrowed_at: borrowed,
                due_at: addDays(borrowed, 14),
                returned_at: addDays(borrowed, 1),
                idempotency_key: generatedId('0002', bookIndex, i),
            });
        }
    }

    for (const loan of fixture.loans ?? []) {
        rows.loans.push({
            ...loan,
            borrowed_at: resolveDate(loan.borrowed_at, today),
            due_at: resolveDate(loan.due_at, today),
            returned_at: resolveDate(loan.returned_at, today),
        });
    }

    return rows;
}

async function insertRows(client, table, rowsForTable) {
    if (rowsForTable.length === 0) return;
    const columns = Object.keys(rowsForTable[0]);
    const values = [];
    const tuples = rowsForTable.map((row) => {
        const placeholders = columns.map((col) => {
            values.push(row[col] ?? null);
            return `$${values.length}`;
        });
        return `(${placeholders.join(', ')})`;
    });
    await client.query(
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${tuples.join(', ')}`,
        values,
    );
}

/**
 * Truncate, then insert one fixture by name ('loans' | 'pagination' | 'top-books').
 * Returns the raw fixture so tests can read ids (e.g. unseeded_ids_for_404_tests).
 */
export async function loadFixture(pool, name, { today = TEST_TODAY } = {}) {
    testDbConfig(); // guard
    const fixture = await readFixture(name);
    const rows = materializeFixture(fixture, { today });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`TRUNCATE ${TABLES_IN_INSERT_ORDER.join(', ')} RESTART IDENTITY CASCADE`);
        for (const table of TABLES_IN_INSERT_ORDER) {
            await insertRows(client, table, rows[table]);
        }
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
    return fixture;
}
