// Central Express error handler. Last middleware in the chain.
//
// Two kinds of errors reach it:
//   - operational (ServerError, isOperational = true): expected, the client
//     caused it or the data state forbids the action. Logged at warn without
//     a stack, sent as-is in the envelope.
//   - programmer (anything else): a bug. Logged at error with the stack,
//     sent as a static 500 envelope so no internals leak.
//
// Every response carries the request id in the body and in X-Request-Id
// (docs/api-contracts/api-error-envelope.md).

import { randomUUID } from 'node:crypto';
import ServerError from './ServerError.js';
import logger from './logger.js';

const REQUEST_ID_HEADER = 'X-Request-Id';

// body-parser (express.json) rejects unparseable JSON with this `type`.
// The envelope maps it to 422 validation_error, the only case with `details`.
const isJsonParseError = (err) => err?.type === 'entity.parse.failed';

const toOperational = (err) => {
    if (err instanceof ServerError) return err;
    if (isJsonParseError(err)) {
        return ServerError.validation('Validation failed', [
            { field: 'body', code: 'invalid_format', message: 'Request body is not valid JSON' },
        ]);
    }
    return null;
};

const errorHandlerMiddleware = (err, req, res, next) => {
    // Headers already on the wire: nothing safe to send, let Express close it.
    if (res.headersSent) return next(err);

    const requestId = req.id ?? randomUUID();
    if (!res.getHeader(REQUEST_ID_HEADER)) res.setHeader(REQUEST_ID_HEADER, requestId);

    const log = req.log ?? logger;
    const operational = toOperational(err);

    if (operational) {
        log.warn(
            { reqId: requestId, statusCode: operational.statusCode, error: operational.error },
            operational.message,
        );
        return res.status(operational.statusCode).json(operational.toEnvelope(requestId));
    }

    log.error({ reqId: requestId, err }, 'Unhandled error in request');
    const internal = ServerError.internal();
    return res.status(internal.statusCode).json(internal.toEnvelope(requestId));
};

export default errorHandlerMiddleware;
