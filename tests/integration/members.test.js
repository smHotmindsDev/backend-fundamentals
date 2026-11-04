import { test, after, describe } from 'node:test';
import { createTestPool, loadFixture } from '../helpers/db.js';
import { startServer, TEST_API_KEY } from '../helpers/http.js';
import assert from 'node:assert/strict';

const pool = createTestPool();
// Seeded once per file, not per test: every case here is a GET and changes
// nothing, and `node --test` runs each file in its own process, so no other
// file can truncate the table while this one runs.
await loadFixture(pool, 'members');

function queryCounter(original) {
    let calls = 0;

    return {
        db: {
            query(...args) {
                calls++;
                return original.query(...args);
            },
        },
        calls: () => calls,
    };
}

// Expected bodies from docs/test-plan.md, computed by hand from members-fixture.json:
// ORDER BY member_id DESC; inside each member `loans` is ORDER BY loan_id DESC,
// only open loans (returned_at IS NULL).

// `GET /members` (page 1, per_page=50) — 50 items.
const PAGE_1 = [
    {
        member_id: '00000000-0000-4000-8000-000000000154',
        first_name: 'Anna',
        last_name: 'Happy',
        loans: [
            {
                loan_id: '00000000-0000-4000-8000-000000000402',
                book: '00000000-0000-4000-8000-000000000202',
                borrowed_at: '2026-09-01',
                due_at: '2026-09-15',
            },
            {
                loan_id: '00000000-0000-4000-8000-000000000401',
                book: '00000000-0000-4000-8000-000000000201',
                borrowed_at: '2026-09-03',
                due_at: '2026-09-17',
            },
        ],
    },
    {
        member_id: '00000000-0000-4000-8000-000000000153',
        first_name: 'Boris',
        last_name: 'Owner',
        loans: [
            {
                loan_id: '00000000-0000-4000-8000-000000000403',
                book: '00000000-0000-4000-8000-000000000201',
                borrowed_at: '2026-09-05',
                due_at: '2026-09-19',
            },
        ],
    },
    { member_id: '00000000-0000-4000-8000-000000000152', first_name: 'Clara', last_name: 'Lee', loans: [] },
    {
        member_id: '00000000-0000-4000-8000-000000000151',
        first_name: 'Lee',
        last_name: 'Wilson',
        loans: [
            {
                loan_id: '00000000-0000-4000-8000-000000000406',
                book: '00000000-0000-4000-8000-000000000203',
                borrowed_at: '2026-08-20',
                due_at: '2026-09-03',
            },
        ],
    },
    { member_id: '00000000-0000-4000-8000-000000000150', first_name: 'Ann_Marie', last_name: 'Smith', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000149', first_name: 'kaylee', last_name: 'Brown', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000148', first_name: 'Olena', last_name: 'Koval', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000147', first_name: 'Melissa', last_name: 'Carter', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000146', first_name: 'George', last_name: 'Mitchell', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000145', first_name: 'Amanda', last_name: 'Campbell', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000144', first_name: 'Brian', last_name: 'Rivera', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000143', first_name: 'Carol', last_name: 'Hall', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000142', first_name: 'Kevin', last_name: 'Baker', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000141', first_name: 'Dorothy', last_name: 'Nelson', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000140', first_name: 'Kenneth', last_name: 'Adams', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000139', first_name: 'Michelle', last_name: 'Green', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000138', first_name: 'Joshua', last_name: 'Flores', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000137', first_name: 'Donna', last_name: 'Hill', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000136', first_name: 'Andrew', last_name: 'Nguyen', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000135', first_name: 'Emily', last_name: 'Torres', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000134', first_name: 'Paul', last_name: 'Scott', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000133', first_name: 'Kimberly', last_name: 'Wright', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000132', first_name: 'Steven', last_name: 'King', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000131', first_name: 'Ashley', last_name: 'Allen', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000130', first_name: 'Donald', last_name: 'Young', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000129', first_name: 'Sandra', last_name: 'Walker', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000128', first_name: 'Mark', last_name: 'Robinson', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000127', first_name: 'Margaret', last_name: 'Lewis', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000126', first_name: 'Anthony', last_name: 'Ramirez', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000125', first_name: 'Betty', last_name: 'Clark', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000124', first_name: 'Matthew', last_name: 'Sanchez', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000123', first_name: 'Nancy', last_name: 'Harris', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000122', first_name: 'Daniel', last_name: 'White', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000121', first_name: 'Lisa', last_name: 'Thompson', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000120', first_name: 'Charles', last_name: 'Perez', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000119', first_name: 'Karen', last_name: 'Martin', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000118', first_name: 'Christopher', last_name: 'Jackson', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000117', first_name: 'Sarah', last_name: 'Moore', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000116', first_name: 'Thomas', last_name: 'Taylor', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000115', first_name: 'Jessica', last_name: 'Thomas', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000114', first_name: 'Joseph', last_name: 'Anderson', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000113', first_name: 'Susan', last_name: 'Wilson', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000112', first_name: 'Richard', last_name: 'Gonzalez', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000111', first_name: 'Barbara', last_name: 'Lopez', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000110', first_name: 'William', last_name: 'Hernandez', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000109', first_name: 'Elizabeth', last_name: 'Martinez', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000108', first_name: 'David', last_name: 'Rodriguez', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000107', first_name: 'Linda', last_name: 'Davis', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000106', first_name: 'Michael', last_name: 'Miller', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000105', first_name: 'Jennifer', last_name: 'Garcia', loans: [] },
];

// `GET /members?page=2` — 5 items (last page). `…0102` keeps its open loan,
// so batching the loans of the first page only is caught here.
const PAGE_2 = [
    { member_id: '00000000-0000-4000-8000-000000000104', first_name: 'John', last_name: 'Jones', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000103', first_name: 'Patricia', last_name: 'Brown', loans: [] },
    {
        member_id: '00000000-0000-4000-8000-000000000102',
        first_name: 'Robert',
        last_name: 'Williams',
        loans: [
            {
                loan_id: '00000000-0000-4000-8000-000000000408',
                book: '00000000-0000-4000-8000-000000000202',
                borrowed_at: '2026-09-10',
                due_at: '2026-09-24',
            },
        ],
    },
    { member_id: '00000000-0000-4000-8000-000000000101', first_name: 'Mary', last_name: 'Johnson', loans: [] },
    { member_id: '00000000-0000-4000-8000-000000000100', first_name: 'James', last_name: 'Smith', loans: [] },
];

describe('GET /members — B4. N+1 lab', () => {
    describe('Happy path', () => {
        test('GET /members, GET /members?page=1, GET /members?search= => 200 + JSON (page 1 with 50 items)', async (t) => {
            const { get } = await startServer(t, { dbClient: pool });
            const cases = [
                { label: 'GET /members', query: '' },
                { label: 'GET /members?page=1', query: '?page=1' },
                { label: 'GET /members?search=', query: '?search=' },
            ];

            for (const { label, query } of cases) {
                await t.test(label, async () => {
                    const res = await get(`/members${query}`, { 'X-API-Key': TEST_API_KEY });
                    assert.equal(res.status, 200, `GET /members${query} returns 200`);
                    const body = await res.json();
                    assert.deepEqual(body, PAGE_1, `GET /members${query} returns JSON (page 1 with 50 items)`);
                });
            }
        });
        test('GET /members?page=2 => 200 + JSON (page 2 with 5 items)', async (t) => {
            const { get } = await startServer(t, { dbClient: pool });

            const res = await get('/members?page=2', { 'X-API-Key': TEST_API_KEY });
            assert.equal(res.status, 200, 'GET /members?page=2 returns 200');
            const body = await res.json();
            assert.deepEqual(body, PAGE_2, 'GET /members?page=2 returns JSON (page 2 with 5 items)');
        });
        test('GET /members?page=3 => 200 + []', async (t) => {
            const { get } = await startServer(t, { dbClient: pool });

            const res = await get('/members?page=3', { 'X-API-Key': TEST_API_KEY });
            assert.equal(res.status, 200, 'GET /members?page=3 returns 200');
            const body = await res.json();
            assert.deepEqual(body, [], 'GET /members?page=3 returns empty array');
        });
        test('GET /members?per_page=55, GET /members?per_page=100 => 200 + JSON (page 1 then page 2, 55 items)', async (t) => {
            const { get } = await startServer(t, { dbClient: pool });
            const cases = [
                { label: 'GET /members?per_page=55', query: '?per_page=55' },
                { label: 'GET /members?per_page=100', query: '?per_page=100' },
            ];
            // One array, not two: the 50 items of page 1 followed by the 5 items of page 2.
            const expected = [...PAGE_1, ...PAGE_2];

            for (const { label, query } of cases) {
                await t.test(label, async () => {
                    const res = await get(`/members${query}`, { 'X-API-Key': TEST_API_KEY });
                    assert.equal(res.status, 200, `GET /members${query} returns 200`);
                    const body = await res.json();
                    assert.deepEqual(body, expected, `GET /members${query} returns JSON (55 items)`);
                });
            }
        });
        test('GET /members?per_page=2 => 200 + JSON (page 1 with 2 items)', async (t) => {
            const { get } = await startServer(t, { dbClient: pool });

            const expected = [
                {
                    member_id: '00000000-0000-4000-8000-000000000154',
                    first_name: 'Anna',
                    last_name: 'Happy',
                    loans: [
                        {
                            loan_id: '00000000-0000-4000-8000-000000000402',
                            book: '00000000-0000-4000-8000-000000000202',
                            borrowed_at: '2026-09-01',
                            due_at: '2026-09-15',
                        },
                        {
                            loan_id: '00000000-0000-4000-8000-000000000401',
                            book: '00000000-0000-4000-8000-000000000201',
                            borrowed_at: '2026-09-03',
                            due_at: '2026-09-17',
                        },
                    ],
                },
                {
                    member_id: '00000000-0000-4000-8000-000000000153',
                    first_name: 'Boris',
                    last_name: 'Owner',
                    loans: [
                        {
                            loan_id: '00000000-0000-4000-8000-000000000403',
                            book: '00000000-0000-4000-8000-000000000201',
                            borrowed_at: '2026-09-05',
                            due_at: '2026-09-19',
                        },
                    ],
                },
            ];

            const res = await get('/members?per_page=2', { 'X-API-Key': TEST_API_KEY });
            assert.equal(res.status, 200, 'GET /members?per_page=2 returns 200');
            const body = await res.json();
            assert.deepEqual(body, expected, 'GET /members?per_page=2 returns JSON (page 1 with 2 items)');
        });
        test('GET /members?search=lee => 200 + JSON (3 items: last name, first name, lower-case substring)', async (t) => {
            const { get } = await startServer(t, { dbClient: pool });

            const expected = [
                { member_id: '00000000-0000-4000-8000-000000000152', first_name: 'Clara', last_name: 'Lee', loans: [] },
                {
                    member_id: '00000000-0000-4000-8000-000000000151',
                    first_name: 'Lee',
                    last_name: 'Wilson',
                    loans: [
                        {
                            loan_id: '00000000-0000-4000-8000-000000000406',
                            book: '00000000-0000-4000-8000-000000000203',
                            borrowed_at: '2026-08-20',
                            due_at: '2026-09-03',
                        },
                    ],
                },
                {
                    member_id: '00000000-0000-4000-8000-000000000149',
                    first_name: 'kaylee',
                    last_name: 'Brown',
                    loans: [],
                },
            ];

            const res = await get('/members?search=lee', { 'X-API-Key': TEST_API_KEY });
            assert.equal(res.status, 200, 'GET /members?search=lee returns 200');
            const body = await res.json();
            assert.deepEqual(body, expected, 'GET /members?search=lee returns JSON (3 items)');
        });
        test('GET /members?search=_ => 200 + JSON (1 item: the only name with a literal "_")', async (t) => {
            const { get } = await startServer(t, { dbClient: pool });
            // An unescaped "_" would be a single-character wildcard and match every member.
            const expected = [
                {
                    member_id: '00000000-0000-4000-8000-000000000150',
                    first_name: 'Ann_Marie',
                    last_name: 'Smith',
                    loans: [],
                },
            ];

            const res = await get('/members?search=_', { 'X-API-Key': TEST_API_KEY });
            assert.equal(res.status, 200, 'GET /members?search=_ returns 200');
            const body = await res.json();
            assert.deepEqual(body, expected, 'GET /members?search=_ returns JSON (1 item)');
        });
        test('GET /members?search=Anna Happy, GET /members?search=na Ha => 200 + JSON (1 item: the fragment spans the space)', async (t) => {
            const { get } = await startServer(t, { dbClient: pool });
            const cases = [
                { label: 'GET /members?search=Anna Happy', query: '?search=Anna Happy' },
                { label: 'GET /members?search=na Ha', query: '?search=na Ha' },
            ];
            const expected = [
                {
                    member_id: '00000000-0000-4000-8000-000000000154',
                    first_name: 'Anna',
                    last_name: 'Happy',
                    loans: [
                        {
                            loan_id: '00000000-0000-4000-8000-000000000402',
                            book: '00000000-0000-4000-8000-000000000202',
                            borrowed_at: '2026-09-01',
                            due_at: '2026-09-15',
                        },
                        {
                            loan_id: '00000000-0000-4000-8000-000000000401',
                            book: '00000000-0000-4000-8000-000000000201',
                            borrowed_at: '2026-09-03',
                            due_at: '2026-09-17',
                        },
                    ],
                },
            ];

            for (const { label, query } of cases) {
                await t.test(label, async () => {
                    const res = await get(`/members${query}`, { 'X-API-Key': TEST_API_KEY });
                    assert.equal(res.status, 200, `GET /members${query} returns 200`);
                    const body = await res.json();
                    assert.deepEqual(body, expected, `GET /members${query} returns JSON (1 item)`);
                });
            }
        });
        test('GET /members?search=%20 => 200 + same body as GET /members (every full name contains a space)', async (t) => {
            const { get } = await startServer(t, { dbClient: pool });

            const res = await get('/members?search=%20', { 'X-API-Key': TEST_API_KEY });
            assert.equal(res.status, 200, 'GET /members?search=%20 returns 200');
            const body = await res.json();
            assert.deepEqual(body, PAGE_1, 'GET /members?search=%20 returns JSON (page 1 with 50 items)');
        });
        test('GET /members?search=Happy Anna, GET /members?search=%25, GET /members?search=zzz => 200 + []', async (t) => {
            const { get } = await startServer(t, { dbClient: pool });
            const cases = [
                // Last name before first name never matches.
                { label: 'GET /members?search=Happy Anna', query: '?search=Happy Anna' },
                // No name contains "%"; an unescaped "%" would be a wildcard and match everything.
                { label: 'GET /members?search=%25', query: '?search=%25' },
                { label: 'GET /members?search=zzz', query: '?search=zzz' },
            ];

            for (const { label, query } of cases) {
                await t.test(label, async () => {
                    const res = await get(`/members${query}`, { 'X-API-Key': TEST_API_KEY });
                    assert.equal(res.status, 200, `GET /members${query} returns 200`);
                    const body = await res.json();
                    assert.deepEqual(body, [], `GET /members${query} returns empty array`);
                });
            }
        });
    });
    // Error / edge: n/a (invalid `page` / `per_page` is the next item)
});

describe('GET /members — query budget (N+1)', () => {
    test('GET /members (page 1, 50 members) => at most 2 SQL statements', async (t) => {
        const counter = queryCounter(pool);
        const { get } = await startServer(t, { dbClient: counter.db });
        const res = await get(`/members`, { 'X-API-Key': TEST_API_KEY });
        assert.equal(res.status, 200, `GET /members returns 200`);
        const body = await res.json();
        assert.equal(body.length, 50, `GET /members returns 50 members`);
        const count = counter.calls();
        assert.ok(count <= 2, `GET /members sends at most 2 SQL statements, got ${count}`);
    });
    test('GET /members?page=2 (5 members) => at most 2 SQL statements', async (t) => {
        const counter = queryCounter(pool);
        const { get } = await startServer(t, { dbClient: counter.db });
        const res = await get(`/members?page=2`, { 'X-API-Key': TEST_API_KEY });
        assert.equal(res.status, 200, `GET /members?page=2 returns 200`);
        const body = await res.json();
        assert.equal(body.length, 5, `GET /members?page=2 returns 5 members`);
        const count = counter.calls();
        assert.ok(count <= 2, `GET /members?page=2 sends at most 2 SQL statements, got ${count}`);
    });
    test('GET /members?page=3 (empty page) => 1 SQL statement: the loans query is skipped', async (t) => {
        const counter = queryCounter(pool);
        const { get } = await startServer(t, { dbClient: counter.db });
        const res = await get(`/members?page=3`, { 'X-API-Key': TEST_API_KEY });
        assert.equal(res.status, 200, `GET /members?page=3 returns 200`);
        const body = await res.json();
        assert.equal(body.length, 0, `GET /members?page=3 returns 0 members`);
        const count = counter.calls();
        assert.equal(count, 1, `GET /members?page=3 sends 1 SQL statement`);
    });
});

describe('GET /members — invalid pagination parameters', () => {
    // Happy path: n/a
    describe('Error / edge', () => {
        test('page or per_page set to 0, -1, abc, 1.5 => 400 bad_request (invalid query parameter; no details)', async (t) => {
            const invalidValues = ['0', '-1', 'abc', '1.5'];
            const cases = ['page', 'per_page'].flatMap((param) =>
                invalidValues.map((value) => ({
                    label: `GET /members?${param}=${value}`,
                    query: `?${param}=${value}`,
                })),
            );

            for (const { label, query } of cases) {
                await t.test(label, async (tt) => {
                    // Fresh server per case: eight requests on one server would trip the 5/min limiter (429).
                    const { get } = await startServer(tt, { dbClient: pool });
                    const res = await get(`/members${query}`, { 'X-API-Key': TEST_API_KEY });
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
