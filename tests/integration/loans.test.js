import { test, after, describe } from 'node:test';
import { createTestPool, loadFixture } from '../helpers/db.js';
import { startServer, UUID_V4 } from '../helpers/http.js';
import assert from 'node:assert/strict';
import { addDays } from '../helpers/clock.js';

const pool = createTestPool();

async function callToCreate(post, bodyData, idempotencyKey) {
    return await post('/loans', bodyData, {
        'Idempotency-Key': idempotencyKey,
    });
}

const countLoans = async () => (await pool.query('SELECT count(*)::int AS n FROM loans')).rows[0].n;

const getCopy = async (loanId) =>
    (await pool.query('SELECT copy_id FROM loans WHERE loan_id = $1', [loanId])).rows[0].copy_id;

describe('POST /loans — transactional borrow', () => {
    describe('Happy path', () => {
        test('Anna + Available Book, fresh Idempotency-Key returns 201 and creates loans row with correct fields', async (t) => {
            // Arrange: a server on the real test DB, and the input for this case
            const fixture = await loadFixture(pool, 'loans');
            const { post } = await startServer(t, { dbClient: pool });
            const member = fixture.members.find((m) => m.first_name === 'Anna').member_id;
            const book = fixture.books.find((b) => b.title === 'Available Book').book_id;
            const idempotencyKey = crypto.randomUUID();
            const bodyData = { member, book };
            const freeCopy = fixture.book_copies.find((c) => c.book_id === book).copy_id;
            // Today comes from the same clock the INSERT uses (SQL CURRENT_DATE),
            // not from Node: new Date() is UTC and drifts near midnight.
            const {
                rows: [{ today }],
            } = await pool.query('SELECT CURRENT_DATE AS today');
            const dueAt = addDays(today, 14);

            // Act: exactly one call — this is the behaviour under test
            const res = await callToCreate(post, bodyData, idempotencyKey);

            // Assert 1: the HTTP contract
            assert.equal(res.status, 201);
            const body = await res.json();
            assert.match(body.loan_id, UUID_V4);
            assert.equal(body.member, member);
            assert.equal(body.book, book);
            assert.equal(body.borrowed_at, today);
            assert.equal(body.due_at, dueAt);

            // Internal columns stay out of the response (create-loan.md response schema)
            assert.equal('returned_at' in body, false, 'a fresh loan has no returned_at');
            assert.equal('copy_id' in body, false, 'copy_id is internal');
            assert.equal('idempotency_key' in body, false, 'idempotency_key is internal');

            // Assert 2: the database really changed, including what the response hides
            const { rows } = await pool.query('SELECT * FROM loans WHERE loan_id = $1', [body.loan_id]);
            assert.equal(rows.length, 1);
            assert.equal(rows[0].copy_id, freeCopy, 'the free copy of Available Book was assigned');
            assert.equal(rows[0].returned_at, null);
            assert.equal(rows[0].idempotency_key, idempotencyKey);

            const { rows: idempotencyRows } = await pool.query('SELECT loan_id FROM loans WHERE idempotency_key = $1', [
                idempotencyKey,
            ]);
            assert.equal(idempotencyRows.length, 1, 'exactly one row per idempotency key');
        });
        test('Same call repeated with same Idempotency-Key returns 201 with same loan_id, no second row inserted', async (t) => {
            // Arrange: a server on the real test DB, and the input for this case
            const fixture = await loadFixture(pool, 'loans');
            const { post } = await startServer(t, { dbClient: pool });
            const member = fixture.members.find((m) => m.first_name === 'Anna').member_id;
            const book = fixture.books.find((b) => b.title === 'Available Book').book_id;
            const idempotencyKey = crypto.randomUUID();
            const bodyData = { member, book };

            // Act: two consecutive calls — this is the behavior subject to testing.
            const resFirst = await callToCreate(post, bodyData, idempotencyKey);
            const loansBefore = await countLoans();
            const bodyBefore = await resFirst.json();
            const resSecond = await callToCreate(post, bodyData, idempotencyKey);
            const loansAfter = await countLoans();
            const bodyAfter = await resSecond.json();

            assert.equal(resFirst.status, 201, 'First call returns 201');
            assert.equal(resSecond.status, 201, 'Second call returns 201');
            assert.deepEqual(
                bodyAfter,
                bodyBefore,
                'The same request, repeated with the same Idempotency-Key, returns the same response.',
            );
            assert.equal(
                loansAfter,
                loansBefore,
                'Same call repeated with same Idempotency-Key no second row inserted',
            );
        });
        test('Parallel calls with the same Idempotency-Key for Anna and Available Book: both return 201 with the same loan_id, one row inserted', async (t) => {
            // Arrange: a server on the real test DB, and the input for this case
            const fixture = await loadFixture(pool, 'loans');
            const { post } = await startServer(t, { dbClient: pool });
            const member = fixture.members.find((m) => m.first_name === 'Anna').member_id;
            const book = fixture.books.find((b) => b.title === 'Available Book').book_id;
            const idempotencyKey = crypto.randomUUID();
            const bodyData = { member, book };

            // Arrange: baseline count before any request is in flight.
            const loansBefore = await countLoans();

            // Act: two parallel calls with the same idempotency key.
            const [resA, resB] = await Promise.all([
                callToCreate(post, bodyData, idempotencyKey),
                callToCreate(post, bodyData, idempotencyKey),
            ]);

            const [bodyA, bodyB] = await Promise.all([resA.json(), resB.json()]);

            const loansAfter = await countLoans();

            assert.equal(resA.status, 201, 'Call A returns 201');
            assert.equal(resB.status, 201, 'Call B returns 201');
            assert.deepEqual(bodyB, bodyA, 'Both calls return the same response body');
            assert.equal(loansAfter, loansBefore + 1, 'Exactly one loan row inserted');
        });
        test('Anna + Multi-Copy Book (one copy already on loan) uses free copy, not already-loaned copy', async (t) => {
            // Arrange: a server on the real test DB, and the input for this case
            const fixture = await loadFixture(pool, 'loans');
            const { post } = await startServer(t, { dbClient: pool });
            const member = fixture.members.find((m) => m.first_name === 'Anna').member_id;
            const book = fixture.books.find((b) => b.title === 'Multi-Copy Book').book_id;
            const idempotencyKey = crypto.randomUUID();
            const bodyData = { member, book };

            // Arrange: the copy already on loan in the fixture, and the free copy expected to be picked
            const loanedCopy = fixture.loans.find((l) => l.book === book).copy_id;
            const { copy_id: freeCopy } = fixture.book_copies.find(
                (c) => c.book_id === book && c.copy_id !== loanedCopy,
            );

            // Act: create a loan for the book (not a specific copy), the server picks the copy
            const res = await callToCreate(post, bodyData, idempotencyKey);
            assert.equal(res.status, 201, 'Call returns 201');

            // Act: read back which copy the created loan actually got
            const body = await res.json();
            const loanId = body.loan_id;
            const copyId = await getCopy(loanId);

            // Assert: the server skipped the loaned copy and took the free one
            assert.notStrictEqual(copyId, loanedCopy, "Anna + Multi-Copy Book doesn't use already-loaned copy");
            assert.equal(copyId, freeCopy, 'Anna + Multi-Copy Book uses free copy');
        });
    });
    describe('Error / edge', () => {
        test('Unknown member_id returns 404 not_found with appropriate error message', async (t) => {
            // Arrange: a server on the real test DB, and the input for this case
            const fixture = await loadFixture(pool, 'loans');
            const { post } = await startServer(t, { dbClient: pool });
            const member = fixture.unseeded_ids_for_404_tests.unknown_member_id;
            const book = fixture.books.find((b) => b.title === 'Available Book').book_id;
            const idempotencyKey = crypto.randomUUID();
            const bodyData = { member, book };
            // Arrange: baseline count before any request.
            const loansBefore = await countLoans();

            // Act
            const res = await callToCreate(post, bodyData, idempotencyKey);

            // Arrange: baseline count after request.
            const loansAfter = await countLoans();

            // Asserts
            assert.equal(res.status, 404, 'Unknown member_id returns 404');
            const body = await res.json();
            assert.equal(body.statusCode, 404, 'Unknown member_id returns 404');
            assert.equal(body.error, 'not_found', 'Unknown member_id returns not_found');
            assert.equal(
                body.message,
                `Member with id:${member} undefined`,
                'Unknown member_id returns appropriate error message: Member with id:<id> undefined',
            );
            assert.equal(loansAfter, loansBefore, 'No rows inserted');
        });
        test('Unknown book_id returns 404 not_found with appropriate error message', async (t) => {
            // Arrange: a server on the real test DB, and the input for this case
            const fixture = await loadFixture(pool, 'loans');
            const { post } = await startServer(t, { dbClient: pool });
            const member = fixture.members.find((m) => m.first_name === 'Anna').member_id;
            const book = fixture.unseeded_ids_for_404_tests.unknown_book_id;
            const idempotencyKey = crypto.randomUUID();
            const bodyData = { member, book };
            // Arrange: baseline count before any request.
            const loansBefore = await countLoans();

            // Act
            const res = await callToCreate(post, bodyData, idempotencyKey);

            // Arrange: baseline count after request.
            const loansAfter = await countLoans();

            // Asserts
            assert.equal(res.status, 404, 'Unknown book_id returns 404');
            const body = await res.json();
            assert.equal(body.statusCode, 404, 'Unknown book_id returns 404');
            assert.equal(body.error, 'not_found', 'Unknown book_id returns not_found');
            assert.equal(
                body.message,
                `Book with id:${book} undefined`,
                'Unknown book_id returns appropriate error message: Member with id:<id> undefined',
            );
            assert.equal(loansAfter, loansBefore, 'No rows inserted');
        });
        test('Booked out book (no available copy) returns 409 conflict with appropriate message', async (t) => {
            // Arrange: a server on the real test DB, and the input for this case
            const fixture = await loadFixture(pool, 'loans');
            const { post } = await startServer(t, { dbClient: pool });
            const member = fixture.members.find((m) => m.first_name === 'Anna').member_id;
            const book = fixture.books.find((b) => b.title === 'Booked Out Book').book_id;
            const idempotencyKey = crypto.randomUUID();
            const bodyData = { member, book };
            // Arrange: baseline count before any request.
            const loansBefore = await countLoans();

            // Act
            const res = await callToCreate(post, bodyData, idempotencyKey);

            // Arrange: baseline count after request.
            const loansAfter = await countLoans();

            // Asserts
            assert.equal(res.status, 409, 'Booked out book (no available copy) returns 409');
            const body = await res.json();
            assert.equal(body.statusCode, 409, 'Booked out book (no available copy) returns 409');
            assert.equal(body.error, 'conflict', 'Booked out book (no available copy) returns conflict');
            assert.equal(
                body.message,
                `copy already taken, conflict`,
                'Booked out book (no available copy) returns appropriate message: copy already taken, conflict',
            );
            assert.equal(loansAfter, loansBefore, 'No rows inserted');
        });
        test('Invalid Content-Type returns 400 bad_request', async (t) => {
            // Arrange: a server on the real test DB, and the input for this case
            const fixture = await loadFixture(pool, 'loans');
            const { post } = await startServer(t, { dbClient: pool });
            const member = fixture.members.find((m) => m.first_name === 'Anna').member_id;
            const book = fixture.books.find((b) => b.title === 'Available Book').book_id;
            const idempotencyKey = crypto.randomUUID();
            const bodyData = { member, book };
            // Arrange: baseline count before any request.
            const loansBefore = await countLoans();

            // Act
            const res = await post('/loans', bodyData, {
                'Idempotency-Key': idempotencyKey,
                'Content-Type': 'text/html',
            });
            assert.equal(res.status, 400, 'Invalid Content-Type returns 400');
            const body = await res.json();
            assert.equal(body.statusCode, 400, 'Invalid Content-Type returns 400');
            assert.equal(body.error, 'bad_request', 'Invalid Content-Type returns bad_request');
        });
        test('Malformed body (member missing or wrong type) returns 422 validation_error with details', async (t) => {
            // Arrange: a server on the real test DB, and the input for this case
            const fixture = await loadFixture(pool, 'loans');
            const { post } = await startServer(t, { dbClient: pool });
            const book = fixture.books.find((b) => b.title === 'Booked Out Book').book_id;
            const idempotencyKey = crypto.randomUUID();
            // Arrange: baseline count before any request.
            const loansBefore = await countLoans();

            const cases = [
                ['missing', undefined],
                ['empty string', ''],
                ['not a uuid', 'not-a-uuid'],
                // Valid RFC 4122 layout but version 1: the client must send v4
                ['uuid v1 instead of v4', '00000000-0000-1000-8000-000000000009'],
            ];

            for (const [label, member] of cases) {
                const bodyData = { member, book };

                await t.test(label, async () => {
                    // Act: exactly one call
                    const res = await callToCreate(post, bodyData, idempotencyKey);

                    // Assert 1: the HTTP contract
                    assert.equal(res.status, 422);
                    const body = await res.json();
                    assert.equal(body.error, 'validation_error');
                    assert.ok(Array.isArray(body.details), 'details must be an array');
                    assert.ok(
                        body.details.some((d) => d.field === 'member'),
                        `details must name Member, got ${JSON.stringify(body.details)}`,
                    );
                    assert.equal('loan_id' in body, false, 'an error response carries no loan');

                    // Assert 2: the database did not change
                    assert.equal(await countLoans(), loansBefore, 'no row inserted');
                });
            }
        });
        test('Malformed body (book missing or wrong type) returns 422 validation_error with details', async (t) => {
            // Arrange: a server on the real test DB, and the input for this case
            const fixture = await loadFixture(pool, 'loans');
            const { post } = await startServer(t, { dbClient: pool });
            const member = fixture.members.find((m) => m.first_name === 'Anna').member_id;
            const idempotencyKey = crypto.randomUUID();
            // Arrange: baseline count before any request.
            const loansBefore = await countLoans();

            const cases = [
                ['missing', undefined],
                ['empty string', ''],
                ['not a uuid', 'not-a-uuid'],
                // Valid RFC 4122 layout but version 1: the client must send v4
                ['uuid v1 instead of v4', '00000000-0000-1000-8000-000000000009'],
            ];

            for (const [label, book] of cases) {
                const bodyData = { member, book };

                await t.test(label, async () => {
                    // Act: exactly one call
                    const res = await callToCreate(post, bodyData, idempotencyKey);

                    // Assert 1: the HTTP contract
                    assert.equal(res.status, 422);
                    const body = await res.json();
                    assert.equal(body.error, 'validation_error');
                    assert.ok(Array.isArray(body.details), 'details must be an array');
                    assert.ok(
                        body.details.some((d) => d.field === 'book'),
                        `details must name Book, got ${JSON.stringify(body.details)}`,
                    );
                    assert.equal('loan_id' in body, false, 'an error response carries no loan');

                    // Assert 2: the database did not change
                    assert.equal(await countLoans(), loansBefore, 'no row inserted');
                });
            }
        });
        test('Missing or non-uuid-v4 Idempotency-Key header with a valid body returns 422 validation_error with details field Idempotency-Key, no row inserted', async (t) => {
            // Arrange: server on the real test DB, a body that is valid on its own
            const fixture = await loadFixture(pool, 'loans');
            const { post } = await startServer(t, { dbClient: pool });
            const member = fixture.members.find((m) => m.first_name === 'Anna').member_id;
            const book = fixture.books.find((b) => b.title === 'Available Book').book_id;
            const bodyData = { member, book };

            // A missing key can't be looked up by key, so compare the table size instead
            const loansBefore = await countLoans();

            const cases = [
                ['missing', undefined],
                ['empty string', ''],
                ['not a uuid', 'not-a-uuid'],
                // Valid RFC 4122 layout but version 1: the client must send v4
                ['uuid v1 instead of v4', '00000000-0000-1000-8000-000000000009'],
            ];

            for (const [label, idempotencyKey] of cases) {
                await t.test(label, async () => {
                    // Act: exactly one call
                    const res = await callToCreate(post, bodyData, idempotencyKey);

                    // Assert 1: the HTTP contract
                    assert.equal(res.status, 422);
                    const body = await res.json();
                    assert.equal(body.error, 'validation_error');
                    assert.ok(Array.isArray(body.details), 'details must be an array');
                    assert.ok(
                        body.details.some((d) => d.field === 'Idempotency-Key'),
                        `details must name Idempotency-Key, got ${JSON.stringify(body.details)}`,
                    );
                    assert.equal('loan_id' in body, false, 'an error response carries no loan');

                    // Assert 2: the database did not change
                    assert.equal(await countLoans(), loansBefore, 'no row inserted');
                });
            }
        });
    });
});

describe('POST /loans — double-borrow race', () => {
    describe('Happy path', () => {
        test('Parallel calls from Anna and Boris to contested book: exactly one 201 (with loans row), one 409, only one open loan and correct member', async (t) => {
            // Arrange: a server on the real test DB, and the input for this case
            const fixture = await loadFixture(pool, 'loans');
            const { post } = await startServer(t, { dbClient: pool });
            const memberA = fixture.members.find((m) => m.first_name === 'Anna').member_id;
            const memberB = fixture.members.find((m) => m.first_name === 'Boris').member_id;
            const book = fixture.books.find((b) => b.title === 'Contested Book').book_id;
            const idempotencyKeyA = crypto.randomUUID();
            const idempotencyKeyB = crypto.randomUUID();
            const bodyDataA = { member: memberA, book };
            const bodyDataB = { member: memberB, book };

            // Arrange: baseline count before any request is in flight.
            const loansBefore = await countLoans();

            // Act: two parallel calls with different idempotency keys.
            const [resA, resB] = await Promise.all([
                callToCreate(post, bodyDataA, idempotencyKeyA),
                callToCreate(post, bodyDataB, idempotencyKeyB),
            ]);
            const bodyA = await resA.json();
            const bodyB = await resB.json();

            const loansAfter = await countLoans();

            const responses = [
                {
                    status: resA.status,
                    body: bodyA,
                    member: memberA,
                },
                {
                    status: resB.status,
                    body: bodyB,
                    member: memberB,
                },
            ];

            const successResponse = responses.find((r) => r.status === 201);
            const conflictResponse = responses.find((r) => r.status === 409);

            assert.ok(successResponse, 'One call returns 201');
            assert.ok(conflictResponse, 'One call returns 409');
            assert.equal(loansAfter, loansBefore + 1, 'Exactly one loan row inserted');

            const resLoan = (
                await pool.query('SELECT loan_id FROM loans WHERE book = $1 AND returned_at IS NULL ORDER BY loan_id', [
                    book,
                ])
            ).rows;
            const successLoan = resLoan[0].loan_id;
            const successMember = (await pool.query('SELECT member FROM loans WHERE loan_id = $1', [successLoan]))
                .rows[0].member;
            const count = resLoan.length;

            assert.equal(count, 1, 'Only one open loan');
            assert.equal(
                successResponse.body.loan_id,
                successLoan,
                'loan_id in the 201 response matches the open loan in DB',
            );
            assert.equal(conflictResponse.body.error, 'conflict', 'One call returns conflict');
            assert.equal(
                conflictResponse.body.message,
                `copy already taken, conflict`,
                'One call returns appropriate message: copy already taken, conflict',
            );
            assert.equal(successResponse.member, successMember, 'Correct member');
        });
    });
    // error/edge: n/a as noted
});

// 3. «assert no loans row remove»
//
// Це формулювання незрозуміле.
// Схоже, ви мали на увазі, що жодна позика не змінилась.
// З невалідним id змінити нічого й не можна, тож вирішіть, що саме тут має сенс перевіряти.
// Наприклад, що returned_at у відкритих позиках з фікстури лишився null.
// Або приберіть цю частину, якщо вона нічого не додає.
//
// 4. Контракт не оновлено
//
// У return-loan.md у розділі Errors досі лише 404. План тепер обіцяє 422 з details[].field = "id", а контракт про це мовчить. Варто додати туди рядок про 422, а заодно й про 500, як у create-loan.md.
//
// Дрібниця
//
// Unit-рядок POST /loans/:id/return uuid v4 parses точніше записати як «:id uuid v4 parses»: схема валідує параметр, а не весь запит.

describe('POST /loans/:id/return — idempotent return', () => {
    describe('Happy path', () => {
        test.todo('Open loan …403 (Returnable Book) returns 200 with the loan and returned_at set to CURRENT_DATE');
        test.todo('Same return repeated on …403 returns 200 with the same body, returned_at unchanged (no-op)');
        test.todo(
            'Parallel returns of open loan …403 both return 200 with identical returned_at, matching the loans row',
        );
    });
    describe('Error / edge', () => {
        test.todo('Unknown loan_id (…997) returns 404 not_found with message Loan with id:<id> undefined');
    });
});

after(() => pool.end());
