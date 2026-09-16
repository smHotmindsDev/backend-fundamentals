// Request id contract (docs/api-contracts/api-error-envelope.md, docs/test-plan.md):
// every response carries a server-generated UUID v4 in X-Request-Id, error
// bodies repeat it as `requestId`, and an incoming X-Request-Id is ignored.
// No database: the app is built with a dummy dbClient and the stub route.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/app.js';

const API_KEY = 'test-key';
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let server;
let baseUrl;

before(async () => {
    const app = createApp({ env: { API_KEY }, dbClient: {} });
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

const get = (path, headers = {}) => fetch(`${baseUrl}${path}`, { headers });

const assertEnvelopeId = async (res) => {
    const headerId = res.headers.get('x-request-id');
    assert.match(headerId, UUID_V4, 'X-Request-Id is a UUID v4');
    const body = await res.json();
    assert.equal(body.requestId, headerId, 'body.requestId equals X-Request-Id');
    return { headerId, body };
};

test('401 without API key carries requestId in header and body', async () => {
    const res = await get('/reports/top-books');
    assert.equal(res.status, 401);
    const { body } = await assertEnvelopeId(res);
    assert.equal(body.error, 'invalid_auth');
});

test('404 for an unknown route carries requestId in header and body', async () => {
    const res = await get('/nope', { 'X-API-Key': API_KEY });
    assert.equal(res.status, 404);
    const { body } = await assertEnvelopeId(res);
    assert.equal(body.error, 'not_found');
});

test('200 response still carries X-Request-Id', async () => {
    const res = await get('/reports/top-books', { 'X-API-Key': API_KEY });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('x-request-id'), UUID_V4);
});

test('incoming X-Request-Id is ignored, server generates its own', async () => {
    const res = await get('/reports/top-books', { 'X-API-Key': API_KEY, 'X-Request-Id': 'forged' });
    const headerId = res.headers.get('x-request-id');
    assert.notEqual(headerId, 'forged');
    assert.match(headerId, UUID_V4);
});

test('each request gets a different requestId', async () => {
    const [a, b] = await Promise.all([get('/nope'), get('/nope')]);
    const ids = [a.headers.get('x-request-id'), b.headers.get('x-request-id')];
    assert.notEqual(ids[0], ids[1]);
});
