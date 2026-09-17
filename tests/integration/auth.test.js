// Auth-lite contract (docs/api-contracts/authentication.md, docs/test-plan.md):
// X-API-Key is required, a valid key gets 5 requests per 60s window,
// the 6th gets 429 with Retry-After. No database needed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {ERROR_CODES, MESSAGES} from '../../src/utils/ServerError.js';
import { startServer, assertEnvelopeId, TEST_API_KEY } from '../helpers/http.js';

const PATH = '/reports/top-books';

test('valid X-API-Key → request continues', async (t) => {
    const { get } = await startServer(t);
    const res = await get(PATH, { 'X-API-Key': TEST_API_KEY });
    assert.equal(res.status, 200);
});
test('missing key → 401 invalid_auth', async (t) => {
    const { get } = await startServer(t);
    const res = await get(PATH);
    assert.equal(res.status, 401);
    const body = await assertEnvelopeId(res);
    assert.equal(body.statusCode, 401);
    assert.equal(body.error, ERROR_CODES[401]);
    assert.equal(body.message, MESSAGES.INVALID_AUTH);
});

test('wrong key → 401 invalid_auth, same message', async (t) => {
    const { get } = await startServer(t);
    const res = await get(PATH, { 'X-API-Key':  'wrong-key' });
    assert.equal(res.status, 401);
    const body = await assertEnvelopeId(res);
    assert.equal(body.statusCode, 401);
    assert.equal(body.error, ERROR_CODES[401]);
    assert.equal(body.message, MESSAGES.INVALID_AUTH);
});

test('valid key, 6th request in the window → 429 rate_limit_error with Retry-After', async (t) => {
    const { get } = await startServer(t);
    for (let i = 0; i < 5; i++) {
        const res = await get(PATH, { 'X-API-Key': TEST_API_KEY });
        assert.equal(res.status, 200)
    }
    const res = await get(PATH, { 'X-API-Key': TEST_API_KEY });
    assert.equal(res.status, 429);
    assert.equal(res.headers.get('retry-after'), '60');
    const body = await assertEnvelopeId(res);
    assert.equal(body.statusCode, 429);
    assert.equal(body.error, ERROR_CODES[429]);
    assert.equal(body.message, MESSAGES.RATE_LIMIT);
});

test('junk keys do not consume the limiter', async (t) => {
    const { get } = await startServer(t);
    const res = await get(PATH, { 'X-API-Key':  'wrong-key' });
    assert.equal(res.status, 401);
    for (let i = 0; i < 5; i++) {
        const res = await get(PATH, { 'X-API-Key': TEST_API_KEY });
        assert.equal(res.status, 200);
    }
});