import { test } from 'node:test';
import assert from 'node:assert/strict';
import validateEnv from '../../src/utils/validateEnv.js';

test('missing API_KEY returns the issues and logs them', (t) => {
    const error = t.mock.method(console, 'error', () => {});

    const result = validateEnv({
        POSTGRES_USER: 'u',
        POSTGRES_PASSWORD: 'p',
        POSTGRES_DB: 'd',
    });

    assert.equal(result.success, false);
    assert.equal(result.error.length, 1);
    assert.deepEqual(result.error[0].path, ['API_KEY']);
    assert.equal(result.error[0].message, 'Invalid input: expected string, received undefined');
    assert.deepEqual(error.mock.calls[0].arguments, [
        'Invalid environment configuration:\n  API_KEY: Invalid input: expected string, received undefined',
    ]);
});
