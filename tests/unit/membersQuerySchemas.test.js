import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { membersQuerySchema } from '../../src/schemas/members.js';

describe('membersQuerySchema validation via node:test', () => {
    describe('Happy path', () => {
        test('GET /members?page=1&per_page=50 => { page: 1, per_page: 50 }', () => {
            assert.deepEqual(membersQuerySchema.parse({ page: '1', per_page: '50' }), { page: 1, per_page: 50 });
        });

        test('GET /members => { page: 1, per_page: 50 }', () => {
            assert.deepEqual(membersQuerySchema.parse({}), { page: 1, per_page: 50 });
        });

        test('GET /members?search=%20 => { page: 1, per_page: 50, search: " " }', () => {
            assert.deepEqual(membersQuerySchema.parse({ search: ' ' }), { page: 1, per_page: 50, search: ' ' });
        });

        test('GET /members?per_page=101 parse', () => {
            assert.deepEqual(membersQuerySchema.parse({ per_page: '101' }), { page: 1, per_page: 101 });
        });

        test('GET /members?search=_ parse', () => {
            assert.deepEqual(membersQuerySchema.parse({ search: '_' }), { page: 1, per_page: 50, search: '_' });
        });
    });
    describe('Error / edge', () => {
        const arr = ['0', '-1', 'abc', '1.5'];

        test('GET /members?page=0, page=-1, page=abc, page=1.5 => invalid page (not a positive integer)', () => {
            arr.forEach((edge) => {
                const res = membersQuerySchema.safeParse({ page: edge });
                assert.equal(res.success, false);
            });
        });

        test('GET /members?page=0, page=-1, page=abc, page=1.5 => invalid page (not a positive integer)', () => {
            arr.forEach((edge) => {
                const res = membersQuerySchema.safeParse({ per_page: edge });
                assert.equal(res.success, false);
            });
        });
    });
});
