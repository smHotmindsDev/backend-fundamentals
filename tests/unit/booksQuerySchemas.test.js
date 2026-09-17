import { test, describe} from 'node:test';
import assert from 'node:assert/strict';
import {booksQuerySchema} from "../../src/schemas/books.js";

describe('booksQuerySchema validation via node:test', () => {
    describe('Happy path', () => {
        test('GET /books?page=1&per_page=10 => { page: 1, per_page: 10 }', () => {
            assert.deepEqual(booksQuerySchema.parse({ page: '1', per_page: '10' }), { page: 1, per_page: 10 });
        })

        test('GET /books => { page: 1, per_page: 10 }', () => {
            assert.deepEqual(booksQuerySchema.parse({}), { page: 1, per_page: 10 });
        })

        test('GET /books?per_page=101 parse', () => {
            assert.deepEqual(booksQuerySchema.parse({ per_page: '101' }), { page: 1, per_page: 101 });
        })

        test('GET /books?search=_ parse', () => {
            assert.deepEqual(booksQuerySchema.parse({ search: '_' }), { page: 1, per_page: 10, search: '_' });
        })

    });
    describe('Error / edge', () => {
        const arr = ['0', '-1', 'abc', '1.5'];

        test('GET /books?page=0, page=-1, page=abc, page=1.5 => invalid page (not a positive integer)', () => {
            arr.forEach(edge => {
                const res = booksQuerySchema.safeParse({ page: edge });
                assert.equal(res.success, false);
            })
        })

        test('GET /books?page=0, page=-1, page=abc, page=1.5 => invalid page (not a positive integer)', () => {
            arr.forEach(edge => {
                const res = booksQuerySchema.safeParse({ per_page: edge });
                assert.equal(res.success, false);
            })
        })
    });
});



