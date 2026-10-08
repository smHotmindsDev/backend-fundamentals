import { test, after, describe } from 'node:test';
import { createTestPool, loadFixture } from '../helpers/db.js';
import { startServer, TEST_API_KEY } from '../helpers/http.js';
import assert from 'node:assert/strict';

const pool = createTestPool();
await loadFixture(pool, 'pagination');

describe('GET /books — pagination', () => {
    describe('Happy path', () => {
        test('GET /books, GET /books?page=1, GET /books?search= => 200 + JSON (page 1 with 10 items)', async (t) => {
            const { get } = await startServer(t, { dbClient: pool });
            const cases = [
                { label: 'GET /books', query: '' },
                { label: 'GET /books?page=1', query: '?page=1' },
                { label: 'GET /books?search=', query: '?search=' },
            ];
            const expected = [
                {
                    book_id: '00000000-0000-0000-0000-000000000014',
                    title: '50% of the Earth',
                    author: '00000000-0000-0000-0000-000000000000',
                    published_at: '1905-01-01',
                },
                {
                    book_id: '00000000-0000-0000-0000-000000000013',
                    title: 'Around the Moon',
                    author: '00000000-0000-0000-0000-000000000000',
                    published_at: '1905-01-01',
                },
                {
                    book_id: '00000000-0000-0000-0000-000000000012',
                    title: 'The Mysterious Island',
                    author: '00000000-0000-0000-0000-000000000000',
                    published_at: '1905-01-01',
                },
                {
                    book_id: '00000000-0000-0000-0000-000000000011',
                    title: 'The Green Ray',
                    author: '00000000-0000-0000-0000-000000000000',
                    published_at: '1905-01-01',
                },
                {
                    book_id: '00000000-0000-0000-0000-000000000010',
                    title: 'around the moon',
                    author: '00000000-0000-0000-0000-000000000000',
                    published_at: '1905-01-01',
                },
                {
                    book_id: '00000000-0000-0000-0000-000000000009',
                    title: 'Paris in the Twentieth Century',
                    author: '00000000-0000-0000-0000-000000000000',
                    published_at: '1905-01-01',
                },
                {
                    book_id: '00000000-0000-0000-0000-000000000008',
                    title: 'The Steam House',
                    author: '00000000-0000-0000-0000-000000000000',
                    published_at: '1905-01-01',
                },
                {
                    book_id: '00000000-0000-0000-0000-000000000007',
                    title: 'Robur the Conqueror',
                    author: '00000000-0000-0000-0000-000000000000',
                    published_at: '1905-01-01',
                },
                {
                    book_id: '00000000-0000-0000-0000-000000000006',
                    title: 'In Search of the Castaways',
                    author: '00000000-0000-0000-0000-000000000000',
                    published_at: '1905-01-01',
                },
                {
                    book_id: '00000000-0000-0000-0000-000000000005',
                    title: 'Five Weeks in a Balloon',
                    author: '00000000-0000-0000-0000-000000000000',
                    published_at: '1905-01-01',
                },
            ];

            for (const { label, query } of cases) {
                await t.test(label, async () => {
                    const res = await get(`/books${query}`, { 'X-API-Key': TEST_API_KEY });
                    assert.equal(res.status, 200, `GET /books${query} returns 200`);
                    const body = await res.json();
                    assert.deepEqual(body, expected, `GET /books${query} returns JSON (page 1 with 10 items)`);
                });
            }
        });
        test('GET /books?page=2 => 200 + JSON (page 2 with 5 items)', async (t) => {
            const { get } = await startServer(t, { dbClient: pool });

            const expected = [
                {
                    book_id: '00000000-0000-0000-0000-000000000004',
                    title: 'Michael Strogoff',
                    author: '00000000-0000-0000-0000-000000000000',
                    published_at: '1905-01-01',
                },
                {
                    book_id: '00000000-0000-0000-0000-000000000003',
                    title: 'From the Earth to the Moon',
                    author: '00000000-0000-0000-0000-000000000000',
                    published_at: '1905-01-01',
                },
                {
                    book_id: '00000000-0000-0000-0000-000000000002',
                    title: 'Journey to the Centre of the Earth',
                    author: '00000000-0000-0000-0000-000000000000',
                    published_at: '1905-01-01',
                },
                {
                    book_id: '00000000-0000-0000-0000-000000000001',
                    title: 'Around the World in 80 Days',
                    author: '00000000-0000-0000-0000-000000000000',
                    published_at: '1905-01-01',
                },
                {
                    book_id: '00000000-0000-0000-0000-000000000000',
                    title: 'Twenty Thousand Leagues',
                    author: '00000000-0000-0000-0000-000000000000',
                    published_at: '1905-01-01',
                },
            ];

            const res = await get(`/books?page=2`, { 'X-API-Key': TEST_API_KEY });
            assert.equal(res.status, 200, `GET /books?page=2 returns 200`);
            const body = await res.json();
            assert.deepEqual(body, expected, 'GET /books?page=2 returns JSON (page 2 with 5 items)');
        });
        test('GET /books?page=3 => 200 + []', async (t) => {
            const { get } = await startServer(t, { dbClient: pool });

            const expected = [];

            const res = await get(`/books?page=3`, { 'X-API-Key': TEST_API_KEY });
            assert.equal(res.status, 200, `GET /books?page=3 returns 200`);
            const body = await res.json();
            assert.deepEqual(body, expected, 'GET /books?page=3 returns empty array');
        });
        test('GET /books?per_page=15, GET /books?per_page=100 => 200 + JSON (page 1 with 15 items)', async (t) => {
            const { get } = await startServer(t, { dbClient: pool });
            const cases = [
                { label: 'GET /books?per_page=15', query: '?per_page=15' },
                { label: 'GET /books?per_page=100', query: '?per_page=100' },
            ];
            const expected = [
                {
                    book_id: '00000000-0000-0000-0000-000000000014',
                    title: '50% of the Earth',
                    author: '00000000-0000-0000-0000-000000000000',
                    published_at: '1905-01-01',
                },
                {
                    book_id: '00000000-0000-0000-0000-000000000013',
                    title: 'Around the Moon',
                    author: '00000000-0000-0000-0000-000000000000',
                    published_at: '1905-01-01',
                },
                {
                    book_id: '00000000-0000-0000-0000-000000000012',
                    title: 'The Mysterious Island',
                    author: '00000000-0000-0000-0000-000000000000',
                    published_at: '1905-01-01',
                },
                {
                    book_id: '00000000-0000-0000-0000-000000000011',
                    title: 'The Green Ray',
                    author: '00000000-0000-0000-0000-000000000000',
                    published_at: '1905-01-01',
                },
                {
                    book_id: '00000000-0000-0000-0000-000000000010',
                    title: 'around the moon',
                    author: '00000000-0000-0000-0000-000000000000',
                    published_at: '1905-01-01',
                },
                {
                    book_id: '00000000-0000-0000-0000-000000000009',
                    title: 'Paris in the Twentieth Century',
                    author: '00000000-0000-0000-0000-000000000000',
                    published_at: '1905-01-01',
                },
                {
                    book_id: '00000000-0000-0000-0000-000000000008',
                    title: 'The Steam House',
                    author: '00000000-0000-0000-0000-000000000000',
                    published_at: '1905-01-01',
                },
                {
                    book_id: '00000000-0000-0000-0000-000000000007',
                    title: 'Robur the Conqueror',
                    author: '00000000-0000-0000-0000-000000000000',
                    published_at: '1905-01-01',
                },
                {
                    book_id: '00000000-0000-0000-0000-000000000006',
                    title: 'In Search of the Castaways',
                    author: '00000000-0000-0000-0000-000000000000',
                    published_at: '1905-01-01',
                },
                {
                    book_id: '00000000-0000-0000-0000-000000000005',
                    title: 'Five Weeks in a Balloon',
                    author: '00000000-0000-0000-0000-000000000000',
                    published_at: '1905-01-01',
                },
                {
                    book_id: '00000000-0000-0000-0000-000000000004',
                    title: 'Michael Strogoff',
                    author: '00000000-0000-0000-0000-000000000000',
                    published_at: '1905-01-01',
                },
                {
                    book_id: '00000000-0000-0000-0000-000000000003',
                    title: 'From the Earth to the Moon',
                    author: '00000000-0000-0000-0000-000000000000',
                    published_at: '1905-01-01',
                },
                {
                    book_id: '00000000-0000-0000-0000-000000000002',
                    title: 'Journey to the Centre of the Earth',
                    author: '00000000-0000-0000-0000-000000000000',
                    published_at: '1905-01-01',
                },
                {
                    book_id: '00000000-0000-0000-0000-000000000001',
                    title: 'Around the World in 80 Days',
                    author: '00000000-0000-0000-0000-000000000000',
                    published_at: '1905-01-01',
                },
                {
                    book_id: '00000000-0000-0000-0000-000000000000',
                    title: 'Twenty Thousand Leagues',
                    author: '00000000-0000-0000-0000-000000000000',
                    published_at: '1905-01-01',
                },
            ];

            for (const { label, query } of cases) {
                await t.test(label, async () => {
                    const res = await get(`/books${query}`, { 'X-API-Key': TEST_API_KEY });
                    assert.equal(res.status, 200, `GET /books${query} returns 200`);
                    const body = await res.json();
                    assert.deepEqual(body, expected, `GET /books${query} returns JSON (page 1 with 15 items)`);
                });
            }
        });
        test('GET /books?search=Around => 200 + JSON (page 1 with 3 items)', async (t) => {
            const { get } = await startServer(t, { dbClient: pool });

            const expected = [
                {
                    book_id: '00000000-0000-0000-0000-000000000013',
                    title: 'Around the Moon',
                    author: '00000000-0000-0000-0000-000000000000',
                    published_at: '1905-01-01',
                },
                {
                    book_id: '00000000-0000-0000-0000-000000000010',
                    title: 'around the moon',
                    author: '00000000-0000-0000-0000-000000000000',
                    published_at: '1905-01-01',
                },
                {
                    book_id: '00000000-0000-0000-0000-000000000001',
                    title: 'Around the World in 80 Days',
                    author: '00000000-0000-0000-0000-000000000000',
                    published_at: '1905-01-01',
                },
            ];

            const res = await get(`/books?search=Around`, { 'X-API-Key': TEST_API_KEY });
            assert.equal(res.status, 200, `GET /books?search=Around returns 200`);
            const body = await res.json();
            assert.deepEqual(body, expected, 'GET /books?search=Around returns JSON (page 1 with 3 items)');
        });
        test('GET /books?search=around the moon => 200 + JSON (page 1 with 2 items)', async (t) => {
            const { get } = await startServer(t, { dbClient: pool });

            const expected = [
                {
                    book_id: '00000000-0000-0000-0000-000000000013',
                    title: 'Around the Moon',
                    author: '00000000-0000-0000-0000-000000000000',
                    published_at: '1905-01-01',
                },
                {
                    book_id: '00000000-0000-0000-0000-000000000010',
                    title: 'around the moon',
                    author: '00000000-0000-0000-0000-000000000000',
                    published_at: '1905-01-01',
                },
            ];

            const res = await get(`/books?search=around the moon`, { 'X-API-Key': TEST_API_KEY });
            assert.equal(res.status, 200, `GET /books?search=around the moon returns 200`);
            const body = await res.json();
            assert.deepEqual(body, expected, 'GET /books?search=around the moon returns JSON (page 1 with 3 items)');
        });
        test('GET /books?search=%25, GET /books?search=50%25 => 200 + JSON (page 1 with 1 item)', async (t) => {
            const { get } = await startServer(t, { dbClient: pool });
            const cases = [
                { label: 'GET /books?search=%25', query: '?search=%25' },
                { label: 'GET /books?search=50%25', query: '?search=50%25' },
            ];
            // The only title with a literal "%". An unescaped fragment would be a wildcard and return every book.
            const expected = [
                {
                    book_id: '00000000-0000-0000-0000-000000000014',
                    title: '50% of the Earth',
                    author: '00000000-0000-0000-0000-000000000000',
                    published_at: '1905-01-01',
                },
            ];

            for (const { label, query } of cases) {
                await t.test(label, async () => {
                    const res = await get(`/books${query}`, { 'X-API-Key': TEST_API_KEY });
                    assert.equal(res.status, 200, `GET /books${query} returns 200`);
                    const body = await res.json();
                    assert.deepEqual(body, expected, `GET /books${query} returns JSON (page 1 with 1 item)`);
                });
            }
        });
        test('GET /books?search=_ => 200 + []', async (t) => {
            const { get } = await startServer(t, { dbClient: pool });

            const res = await get('/books?search=_', { 'X-API-Key': TEST_API_KEY });
            assert.equal(res.status, 200, 'GET /books?search=_ returns 200');
            const body = await res.json();
            assert.deepEqual(body, [], 'GET /books?search=_ returns empty array');
        });
    });
    // Error / edge: n/a (invalid `page` / `per_page` is the next item)
});

describe('GET /books — invalid pagination parameters', () => {
    // Happy path: n/a
    describe('Error / edge', () => {
        test('page or per_page set to 0, -1, abc, 1.5 => 400 bad_request (invalid query parameter; no details)', async (t) => {
            const invalidValues = ['0', '-1', 'abc', '1.5'];
            const cases = ['page', 'per_page'].flatMap((param) =>
                invalidValues.map((value) => ({ label: `GET /books?${param}=${value}`, query: `?${param}=${value}` })),
            );

            for (const { label, query } of cases) {
                await t.test(label, async (tt) => {
                    // Fresh server per case: eight requests on one server would trip the 5/min limiter (429).
                    const { get } = await startServer(tt, { dbClient: pool });
                    const res = await get(`/books${query}`, { 'X-API-Key': TEST_API_KEY });
                    assert.equal(res.status, 400, `${label} returns 400`);
                    const body = await res.json();

                    assert.equal(body.statusCode, 400, `${label} returns statusCode 400`);
                    assert.equal(body.error, 'bad_request', `${label} returns bad_request`);
                    assert.equal(body.message, 'invalid query parameter', `${label} returns invalid query parameter`);
                    assert.equal(body.details, undefined, `${label} has no details`);
                });
            }
        });
    });
});

after(() => pool.end());
