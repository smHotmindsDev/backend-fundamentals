// HTTP helpers for tests that talk to the app through a real server.
// No database: the app gets a dummy dbClient, so only DB-free routes work.

import assert from 'node:assert/strict';
import { createApp } from '../../src/app.js';

export const TEST_API_KEY = 'test-key';
export const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * Starts a fresh app (fresh limiter store) on a free port and closes it
 * when the test ends, even if an assertion fails.
 * `options` are passed to createApp and override the defaults.
 */
export async function startServer(t, options = {}) {
    const app = createApp({ env: { API_KEY: TEST_API_KEY }, dbClient: {}, ...options });
    const server = app.listen(0);
    t.after(() => new Promise((resolve) => server.close(resolve)));
    await new Promise((resolve) => server.once('listening', resolve));

    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const get = (path, headers = {}) => fetch(`${baseUrl}${path}`, { headers });

    return { get };
}

/** Error body carries a UUID v4 requestId equal to X-Request-Id. Returns the parsed body. */
export async function assertEnvelopeId(res) {
    const headerId = res.headers.get('x-request-id');
    assert.match(headerId, UUID_V4, 'X-Request-Id is a UUID v4');
    const body = await res.json();
    assert.equal(body.requestId, headerId, 'body.requestId equals X-Request-Id');
    return body;
}
