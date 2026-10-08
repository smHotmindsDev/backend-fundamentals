// Central error handler, programmer-error path (docs/api-contracts/api-error-envelope.md):
// anything that is neither a ServerError nor a JSON parse error must become a
// static 500 envelope with no internals leaked, still carrying the request id.
// No database: the dummy dbClient has no `query`, so the top-books route throws
// a TypeError inside its async handler, which Express 5 forwards to the handler.

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

test('an unexpected error in a route becomes 500 internal_error with a request id and no details', async () => {
    const res = await fetch(`${baseUrl}/reports/top-books`, { headers: { 'X-API-Key': API_KEY } });

    assert.equal(res.status, 500, 'programmer error => 500');
    const body = await res.json();
    assert.equal(body.statusCode, 500);
    assert.equal(body.error, 'internal_error');
    assert.equal(body.message, 'An unexpected error occurred', 'static message, nothing from the TypeError leaks');
    assert.equal(body.details, undefined, 'no details on a 500');
    assert.match(res.headers.get('x-request-id'), UUID_V4, 'X-Request-Id is a UUID v4');
    assert.equal(body.requestId, res.headers.get('x-request-id'), 'body.requestId equals X-Request-Id');
});
