// Structured request logging with a server-generated request id.
//
// - req.id is a fresh UUID v4 per request. An incoming X-Request-Id is ignored
//   on purpose (docs/api-contracts/api-error-envelope.md): clients must not be
//   able to forge or collide log identifiers.
// - The id is echoed in the X-Request-Id response header.
// - req.log is a child logger that carries `reqId`, so every line written
//   during the request (routes, error handler) shares the same id.
// - One completion line per request with method, url, status, response time.

import { randomUUID } from 'node:crypto';
import pinoHttp from 'pino-http';
import logger from './logger.js';

const REQUEST_ID_HEADER = 'X-Request-Id';

const levelFor = (res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
};

export const createRequestLogger = (log = logger) =>
    pinoHttp({
        logger: log,
        quietReqLogger: true, // req.log lines carry only reqId, not the whole req object
        genReqId: (req, res) => {
            const id = randomUUID();
            res.setHeader(REQUEST_ID_HEADER, id);
            return id;
        },
        customLogLevel: (req, res, err) => levelFor(res, err),
        customSuccessMessage: (req, res) => `${req.method} ${req.originalUrl ?? req.url} ${res.statusCode}`,
        customErrorMessage: (req, res) => `${req.method} ${req.originalUrl ?? req.url} ${res.statusCode}`,
        serializers: {
            req: (req) => ({ id: req.id, method: req.method, url: req.url }),
            res: (res) => ({ statusCode: res.statusCode }),
        },
    });

const requestLoggerMiddleware = createRequestLogger();

export default requestLoggerMiddleware;
