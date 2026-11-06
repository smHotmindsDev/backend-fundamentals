import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createPagination, MAX_PER_PAGE } from '../../src/utils/pagination.js';

describe('Pagination math (`GET /books`)', () => {
    describe('Happy path', () => {
        test('GET /books?page=1&per_page=10 → LIMIT 10 OFFSET 0', () => {
            const pagination = createPagination({ page: 1, perPage: 10 });
            assert.deepEqual(pagination, { limit: 10, offset: 0 });
        });
        test('GET /books?page=2&per_page=10 → LIMIT 10 OFFSET 10', () => {
            const pagination = createPagination({ page: 2, perPage: 10 });
            assert.deepEqual(pagination, { limit: 10, offset: 10 });
        });
        test('GET /books?per_page=101 → LIMIT 100 OFFSET 0', () => {
            const pagination = createPagination({ page: 1, perPage: 101 });
            assert.deepEqual(pagination, { limit: MAX_PER_PAGE, offset: 0 });
        });
        test('GET /books?page=2&per_page=101 → LIMIT 100 OFFSET 100', () => {
            const pagination = createPagination({ page: 2, perPage: 101 });
            assert.deepEqual(pagination, { limit: MAX_PER_PAGE, offset: 100 });
        });
    });
    describe('error/edge', () => {
        test('GET /books?page=1&per_page=100 → LIMIT 100 OFFSET 0', () => {
            const pagination = createPagination({ page: 1, perPage: 100 });
            assert.deepEqual(pagination, { limit: MAX_PER_PAGE, offset: 0 });
        });
    });
});
