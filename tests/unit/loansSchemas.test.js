import { test, describe} from 'node:test';
import assert from 'node:assert/strict';
import {loansHeaderSchema, loansBodySchema} from "../../src/schemas/loans.js";

const memberId = "00000000-0000-4000-8000-000000000102";
const bookId = "00000000-0000-4000-8000-000000000205";
const idempotencyKey = "00000000-0000-4000-8000-000000000009";

// Every invalid case is complete except for the one field under test, so the
// parse fails for the reason in the case name and for nothing else.
const valid = { member: memberId, book: bookId };
const validHeader = { idempotencyKey };

describe('loansSchemas validation via node:test', () => {
    describe('Happy path', () => {
        test('POST /loans body { member: uuid, book: uuid } + Idempotency-Key uuid parses', () => {
            const headerRes = loansHeaderSchema.safeParse(validHeader)
            const res = loansBodySchema.safeParse(valid);
            assert.equal(headerRes.success, true, headerRes.error?.message);
            assert.equal(res.success, true, res.error?.message);
        })

    });
    describe('Error / edge', () => {
        // [case name, input, field expected in the issues]
        const invalid = [
            ['member missing',    { ...valid, member: undefined },  'member'],
            ['book missing',      { ...valid, book: undefined },    'book'],
            ['member wrong type', { ...valid, member: 123 },        'member'],
            ['member not a uuid', { ...valid, member: 'abc' },      'member'],
            ['empty body',        {},                               'member'],
        ];

        const invalidKey = [
            ['Idempotency-Key missing',      { idempotencyKey: undefined }],
            ['Idempotency-Key empty string', { idempotencyKey: '' }],
            ['Idempotency-Key not a uuid',   { idempotencyKey: 'not-a-uuid' }],
            // Valid RFC 4122 layout but version 1: the client must send v4.
            ['Idempotency-Key uuid v1',      { idempotencyKey: '00000000-0000-1000-8000-000000000009' }],
        ];

        const assertInvalidField = (input, field) => {
            const res = loansBodySchema.safeParse(input);
            assert.equal(res.success, false);
            const fields = res.error.issues.map((issue) => issue.path.join('.'));
            assert.ok(fields.includes(field), `expected an issue on "${field}", got: ${fields.join(', ') || 'none'}`);
        };

        const assertInvalidFieldInHeader = (input, field) => {
            const res = loansHeaderSchema.safeParse(input);
            assert.equal(res.success, false);
            const fields = res.error.issues.map((issue) => issue.path.join('.'));
            assert.ok(fields.includes(field), `expected an issue on "${field}", got: ${fields.join(', ') || 'none'}`);
        };

        test('POST /loans body: member / book missing or wrong type → invalid', () => {
            for (const [name, body, field] of invalid) {
                test(`POST /loans body: ${name} → invalid`, () => assertInvalidField(body, field));
            }
        })

        test('POST /loans Idempotency-Key missing, empty string or not a uuid v4 → invalid', () => {
            for (const [name, header] of invalidKey) {
                test(`POST /loans: ${name} → invalid`, () => assertInvalidFieldInHeader(header, 'idempotencyKey'));
            }
        })
    });
});
