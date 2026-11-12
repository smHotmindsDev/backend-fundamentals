import { test, after } from 'node:test';
import { createTestPool, loadFixture } from '../helpers/db.js';
import { startServer, TEST_API_KEY } from '../helpers/http.js';
import assert from 'node:assert/strict';

const pool = createTestPool();

test('Seed member → borrow → return → verify report', async (t) => {
    const fixture = await loadFixture(pool, 'loans');
    const { get, post } = await startServer(t, { dbClient: pool });
    const member = fixture.members.find((m) => m.first_name === 'Anna').member_id;
    const borrowBook = fixture.books.find((b) => b.title === 'Available Book').book_id;
    const idempotencyKey = crypto.randomUUID();
    const borrowBodyData = { member, book: borrowBook };

    const borrowRes = await post('/loans', borrowBodyData, {
        'Idempotency-Key': idempotencyKey,
    });

    assert.equal(borrowRes.status, 201, 'borrow => 201');

    const borrowBody = await borrowRes.json();
    const loanId = borrowBody.loan_id;

    const returnRes = await post(`/loans/${loanId}/return`);
    assert.equal(returnRes.status, 200, 'return => 200');

    const returnBody = await returnRes.json();
    assert.ok(returnBody.returned_at, 'return => returned_at set');

    const reportRes = await get(`/reports/top-books`, { 'X-API-Key': TEST_API_KEY });
    assert.equal(reportRes.status, 200, `report => 200`);

    const reportBody = await reportRes.json();
    const row = reportBody.find((l) => l.book_id === borrowBook);
    assert.ok(row, 'Available Book is in the ranking');
    assert.ok(row.borrow_count >= 1, 'returned loan still counts: borrow_count >= 1');
});

after(() => pool.end());
