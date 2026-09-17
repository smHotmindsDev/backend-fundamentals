import { test } from 'node:test';
import assert from 'node:assert/strict';
import {createRateLimiter} from "../../src/utils/rateLimiter.js";

test('5 requests with a valid key in the window are allowed', async (t) => {
    const limiter = createRateLimiter({ limit: 5, windowMs: 60_000 });

    for (let i = 0; i < 5; i++) {
        assert.equal(limiter.consume('k', 0).allowed, true);
    }
});


test('6th request before resetTime → deny', async (t) => {
    const limiter = createRateLimiter({ limit: 5, windowMs: 60_000 });

    for (let i = 0; i < 5; i++) limiter.consume('k', 0);

    assert.equal(limiter.consume('k', 59_999).allowed, false);  // 1 ms before reset
});

test('6th request after resetTime → allowed again', async (t) => {
    const limiter = createRateLimiter({ limit: 5, windowMs: 60_000 });

    for (let i = 0; i < 5; i++) limiter.consume('k', 0);

    assert.equal(limiter.consume('k', 59_999).allowed, false);  // 1 ms before reset
    assert.equal(limiter.consume('k', 60_000).allowed, true);   // exactly at reset
});