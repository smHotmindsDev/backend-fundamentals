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

    // POST defaults: auth runs before every route, so a test about the body or
    // the Content-Type still needs a valid key. `get` deliberately keeps no
    // default key — the auth tests rely on an unauthenticated GET.
    // No Idempotency-Key here: every test passes its own, explicitly.
    const POST_DEFAULTS = { 'Content-Type': 'application/json', 'X-API-Key': TEST_API_KEY };

    // Case-insensitive merge; `null` removes a default, e.g. { 'X-API-Key': null }.
    const withHeaders = (overrides) => {
        const headers = new Headers(POST_DEFAULTS); // fresh per call -> parallel-safe
        for (const [name, value] of Object.entries(overrides)) {
            if (value == null) headers.delete(name);
            else headers.set(name, value);
        }
        return headers;
    };

    /**
     * post('/loans', { member, book }, { 'Idempotency-Key': key })
     * A string body is sent as is (raw / malformed cases); anything else is JSON-encoded.
     */
    const post = (path, body, headers = {}) => {
        const payload = typeof body === 'string' ? body : JSON.stringify(body);
        return fetch(`${baseUrl}${path}`, {
            method: 'POST',
            headers: withHeaders(headers),
            // Bytes, not a string: fetch stamps Content-Type: text/plain on a string
            // body, which would make the "no Content-Type" case untestable.
            body: body === undefined ? undefined : new TextEncoder().encode(payload),
        });
    };

    return { baseUrl, get, post };
}

/** Error body carries a UUID v4 requestId equal to X-Request-Id. Returns the parsed body. */
export async function assertEnvelopeId(res) {
    const headerId = res.headers.get('x-request-id');
    assert.match(headerId, UUID_V4, 'X-Request-Id is a UUID v4');
    const body = await res.json();
    assert.equal(body.requestId, headerId, 'body.requestId equals X-Request-Id');
    return body;
}
