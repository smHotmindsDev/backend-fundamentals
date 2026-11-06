import { test } from 'node:test';
import assert from 'node:assert/strict';
import ServerError, { ERROR_CODES } from '../../src/utils/ServerError.js';

test('statusCode outside the API error envelope throws TypeError', () => {
    assert.throws(
        () => new ServerError('nope', 403),
        (err) => {
            assert.ok(err instanceof TypeError);
            assert.equal(
                err.message,
                `ServerError: statusCode 403 is not in the API error envelope ` +
                    `(allowed: ${Object.keys(ERROR_CODES).join(', ')})`,
            );
            return true;
        },
    );
});
