// Operational error for the Library API.
//
// One instance = one API error envelope (docs/api-contracts/api-error-envelope.md):
//   { statusCode, error, message, requestId, details? }
//
// `error` is never chosen by the caller; it follows from `statusCode` through
// ERROR_CODES. `requestId` is not stored here: the error is created deep in a
// route or repository, the id lives on the request, and only the error handler
// has both, so it is passed to toEnvelope() at serialisation time.
//
// Misuse of this class (unknown status, `details` outside 422) is a programmer
// error and throws a plain TypeError, not a ServerError.

export const ERROR_CODES = Object.freeze({
    400: 'bad_request',
    401: 'invalid_auth',
    404: 'not_found',
    409: 'conflict',
    422: 'validation_error',
    429: 'rate_limit_error',
    500: 'internal_error',
});

// Messages the contracts fix verbatim. Tests import these instead of retyping.
export const MESSAGES = Object.freeze({
    INVALID_AUTH: 'No valid API key provided',
    RATE_LIMIT: 'Rate limit exceeded.',
    INTERNAL: 'An unexpected error occurred',
});

class ServerError extends Error {
    /**
     * @param {string} message
     * @param {number} statusCode one of the keys of ERROR_CODES
     * @param {{ details?: Array<{ field: string, code: string, message: string }> }} [options]
     */
    constructor(message, statusCode, { details } = {}) {
        super(message);

        const error = ERROR_CODES[statusCode];
        if (error === undefined) {
            throw new TypeError(
                `ServerError: statusCode ${statusCode} is not in the API error envelope ` +
                `(allowed: ${Object.keys(ERROR_CODES).join(', ')})`,
            );
        }

        if (details !== undefined) {
            if (statusCode !== 422) {
                throw new TypeError('ServerError: `details` is only allowed with statusCode 422 (validation_error)');
            }
            if (!Array.isArray(details)) {
                throw new TypeError('ServerError: `details` must be an array');
            }
            this.details = details;
        }

        this.name = 'ServerError';
        this.statusCode = statusCode;
        this.error = error;
        this.isOperational = true; // expected runtime error, safe to send to the client
        Error.captureStackTrace(this, this.constructor);
    }

    /** Build the response body. Key order follows the contract. */
    toEnvelope(requestId) {
        const envelope = {
            statusCode: this.statusCode,
            error: this.error,
            message: this.message,
            requestId,
        };
        if (this.details !== undefined) {
            envelope.details = this.details;
        }
        return envelope;
    }

    static badRequest(message) {
        return new ServerError(message, 400);
    }

    static invalidAuth() {
        return new ServerError(MESSAGES.INVALID_AUTH, 401);
    }

    static notFound(message) {
        return new ServerError(message, 404);
    }

    static conflict(message) {
        return new ServerError(message, 409);
    }

    static validation(message, details) {
        return new ServerError(message, 422, { details });
    }

    static rateLimit() {
        return new ServerError(MESSAGES.RATE_LIMIT, 429);
    }

    static internal() {
        return new ServerError(MESSAGES.INTERNAL, 500);
    }
}

export default ServerError;
