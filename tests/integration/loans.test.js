import {test, after, describe} from 'node:test';
import {createTestPool, loadFixture} from "../helpers/db.js";
import { startServer, UUID_V4} from "../helpers/http.js";
import assert from "node:assert/strict";
import {addDays} from "../helpers/clock.js";

const pool = createTestPool();
describe('POST /loans — transactional borrow', () => {
    describe('Happy path' , () => {
        test('Anna + Available Book, fresh Idempotency-Key returns 201 and creates loans row with correct fields', async (t) => {
            // Arrange: a server on the real test DB, and the input for this case
            const fixture = await loadFixture(pool, 'loans');
            const { post } = await startServer(t, { dbClient: pool });
            const member = fixture.members.find(m => m.first_name === 'Anna').member_id;
            const book = fixture.books.find(b => b.title === 'Available Book').book_id;
            const idempotencyKey = crypto.randomUUID();
            const bodyData = {member, book};
            const freeCopy = fixture.book_copies.find(c => c.book_id === book).copy_id;
            // Today comes from the same clock the INSERT uses (SQL CURRENT_DATE),
            // not from Node: new Date() is UTC and drifts near midnight.
            const { rows: [{ today }] } = await pool.query('SELECT CURRENT_DATE AS today');
            const dueAt = addDays(today, 14);

            // Act: exactly one call — this is the behaviour under test
            const res = await post(
                '/loans',
                bodyData,
                {
                    'Idempotency-Key': idempotencyKey
                }); // post already adds Content-Type: application/json and a valid X-API-Key.

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

            const { rows: idempotencyRows } = await pool.query('SELECT loan_id FROM loans WHERE idempotency_key = $1', [idempotencyKey]);
            assert.equal(idempotencyRows.length, 1, 'exactly one row per idempotency key');
        })
        test.todo('Same call repeated with same Idempotency-Key returns 201 with same loan_id, no second row inserted')
        test.todo('Parallel calls with Anna, Available Book, same Idempotency-Key both return 201 with identical loan_id, only one row inserted')
        test.todo('Anna + Multi-Copy Book (one copy already on loan) uses free copy, not already-loaned copy')
    })
    describe('Error / edge', () => {
        test.todo('Unknown member_id returns 404 not_found with appropriate error message')
        test.todo('Unknown book_id returns 404 not_found with appropriate error message')
        test.todo('Booked out book (no available copy) returns 409 conflict with appropriate message')
        test.todo('Invalid Content-Type returns 400 bad_request')
        test.todo('Malformed body (member/book missing or wrong type) returns 422 validation_error with details')
        test.todo('Missing or non-uuid Idempotency-Key header with a valid body returns 422 validation_error with details field Idempotency-Key, no row inserted')
    })
})

describe('POST /loans — double-borrow race', () => {
    describe('Happy path', () => {
        test.todo('Parallel calls from Anna and Boris to contested book: exactly one 201 (with loans row), one 409, only one open loan and correct member')
    })
    // error/edge: n/a as noted
})

after(() => pool.end());