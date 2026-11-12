import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from '../../src/utils/rateLimiter.js';
import ServerError from '../../src/utils/ServerError.js';

test('5 requests with a valid key in the window are allowed', async (t) => {
    const limiter = createRateLimiter({ limit: 5, windowMs: 60_000 });

    for (let i = 0; i < 5; i++) {
        assert.equal(limiter.consume('k', 0).allowed, true);
    }
});

test('6th request before resetTime → deny', async (t) => {
    const limiter = createRateLimiter({ limit: 5, windowMs: 60_000 });

    for (let i = 0; i < 5; i++) limiter.consume('k', 0);

    assert.equal(limiter.consume('k', 59_999).allowed, false); // 1 ms before reset
});

test('6th request after resetTime → allowed again', async (t) => {
    const limiter = createRateLimiter({ limit: 5, windowMs: 60_000 });

    for (let i = 0; i < 5; i++) limiter.consume('k', 0);

    assert.equal(limiter.consume('k', 59_999).allowed, false); // 1 ms before reset
    assert.equal(limiter.consume('k', 60_000).allowed, true); // exactly at reset
});

test('non-number limit or windowMs → ServerError 500', () => {
    for (const options of [
        { limit: '5', windowMs: 60_000 },
        { limit: 5, windowMs: '60000' },
    ]) {
        assert.throws(
            () => createRateLimiter(options),
            (err) => {
                assert.ok(err instanceof ServerError);
                assert.equal(err.statusCode, 500);
                assert.equal(err.message, 'incorrect type of arguments');
                return true;
            },
        );
    }
});

test('sweep keeps an open window and allows an elapsed one', (t) => {
    t.mock.timers.enable({ apis: ['setInterval', 'Date'], now: 0 });
    const limiter = createRateLimiter({ limit: 5, windowMs: 60_000 });

    for (let i = 0; i < 5; i++) {
        assert.equal(limiter.consume('elapsed', Date.now()).allowed, true); // resetTime = 60_000
    }

    t.mock.timers.tick(30_000);
    for (let i = 0; i < 5; i++) {
        assert.equal(limiter.consume('open', Date.now()).allowed, true); // resetTime = 90_000
    }

    t.mock.timers.tick(30_000); // interval fires at 60_000: drop elapsed, keep open

    assert.equal(limiter.consume('open', Date.now()).allowed, false);
    assert.equal(limiter.consume('elapsed', Date.now()).allowed, true);
});
