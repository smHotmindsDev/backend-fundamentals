import { test, after, describe } from 'node:test';
import { createTestPool, loadFixture, truncateAll } from '../helpers/db.js';
import { startServer, TEST_API_KEY } from '../helpers/http.js';
import assert from 'node:assert/strict';

const pool = createTestPool();

describe('GET /reports/top-books — empty database', () => {
    describe('Happy path', () => {
        test('no loans and no books => 200 + []', async (t) => {
            await truncateAll(pool);
            const { get } = await startServer(t, { dbClient: pool });

            const res = await get(`/reports/top-books`, { 'X-API-Key': TEST_API_KEY });

            assert.equal(res.status, 200, `no loans and no books => 200`);
            const body = await res.json();
            assert.deepEqual(body, [], 'no loans and no books => []');
        });
    });
    // Error / edge: n/a
});

describe('GET /reports/top-books — ranked report', () => {
    describe('Happy path', () => {
        test('top-books fixture => 200 + top 10 by 90-day borrow_count, tie-break by book_id, zeros fill the tail', async (t) => {
            const {
                rows: [{ today }],
            } = await pool.query('SELECT CURRENT_DATE AS today');
            const fixture = await loadFixture(pool, 'top-books', { today });

            const { get } = await startServer(t, { dbClient: pool });

            const expected = [
                { book_id: '00000000-0000-0000-0000-000000000000', title: 'Twenty Thousand Leagues', borrow_count: 50 },
                {
                    book_id: '00000000-0000-0000-0000-000000000001',
                    title: 'Around the World in 80 Days',
                    borrow_count: 49,
                },
                {
                    book_id: '00000000-0000-0000-0000-000000000002',
                    title: 'Journey to the Centre of the Earth',
                    borrow_count: 48,
                },
                {
                    book_id: '00000000-0000-0000-0000-000000000003',
                    title: 'From the Earth to the Moon',
                    borrow_count: 47,
                },
                { book_id: '00000000-0000-0000-0000-000000000004', title: 'Michael Strogoff', borrow_count: 46 },
                { book_id: '00000000-0000-0000-0000-000000000005', title: 'Five Weeks in a Balloon', borrow_count: 45 },
                {
                    book_id: '00000000-0000-0000-0000-000000000006',
                    title: 'In Search of the Castaways',
                    borrow_count: 44,
                },
                { book_id: '00000000-0000-0000-0000-000000000007', title: 'Robur the Conqueror', borrow_count: 44 },
                { book_id: '00000000-0000-0000-0000-000000000008', title: 'The Steam House', borrow_count: 0 },
                {
                    book_id: '00000000-0000-0000-0000-000000000009',
                    title: 'Paris in the Twentieth Century',
                    borrow_count: 0,
                },
            ];

            const res = await get(`/reports/top-books`, { 'X-API-Key': TEST_API_KEY });

            assert.equal(res.status, 200, `top-books fixture => 200`);
            const body = await res.json();
            assert.equal(body.length, 10, 'LIMIT 10: exactly ten rows');
            assert.equal(
                typeof body[0].borrow_count,
                'number',
                'borrow_count is COUNT(...)::int, a number, not a pg string',
            );
            assert.deepEqual(
                body.map((r) => r.borrow_count),
                [50, 49, 48, 47, 46, 45, 44, 44, 0, 0],
                'counts inside the 90-day window only',
            );
            assert.equal(body[6].book_id, fixture.books[6].book_id, 'tie 44/44 ordered by book_id ascending');
            assert.equal(body[8].title, 'The Steam House', 'loans at 91 days are outside the window');
            assert.deepEqual(body, expected, 'full body matches the contract');
        });
    });
    // Error / edge: n/a
});

after(() => pool.end());
