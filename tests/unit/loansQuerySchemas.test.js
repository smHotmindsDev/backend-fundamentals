import { test, describe} from 'node:test';
import assert from 'node:assert/strict';
import {loansBodySchema} from "../../src/schemas/loans.js";

const memberId = "00000000-0000-4000-8000-000000000102";
const bookId = "00000000-0000-4000-8000-000000000205";

describe('loansBodySchema validation via node:test', () => {
    describe('Happy path', () => {
        test('POST /loans body { member: uuid, book: uuid } parses', () => {
            const res = loansBodySchema.safeParse({ member: memberId, book: bookId });
            assert.equal(res.success, true, res.error?.message);
        })

    });
    describe('Error / edge', () => {
        const invalid = [
            ['member missing',    { book: bookId }],
            ['book missing',      { member: memberId }],
            ['member wrong type', { member: 123, book: bookId }],
            ['member not a uuid', { member: 'abc', book: bookId }],
            ['empty body',        {}],
        ];

        test('POST /loans body: member / book missing or wrong type → invalid', () => {
            for (const [name, body] of invalid) {
                test(`POST /loans body: ${name} → invalid`, () => {
                    const res = loansBodySchema.safeParse(body);
                    assert.equal(res.success, false);
                });
            }
        })
    });
});



