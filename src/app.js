import express from 'express';
import { router } from './routes.js';
import requestLoggerMiddleware from './utils/requestLoggerMiddleware.js';
import { createAuthMiddleware } from './utils/authMiddleware.js';
import {createRateLimiter} from "./utils/rateLimiter.js";
import routeNotFoundHandler from './utils/routeNotFoundHandler.js';
import errorHandlerMiddleware from './utils/errorHandlerMiddleware.js';

export function createApp({ env, dbClient, now = Date.now}) {
    const app = express();

    // Request id + logger first, so every request (even a malformed-JSON 422)
    // has req.id, req.log and the X-Request-Id header.
    app.use(requestLoggerMiddleware);

    // Global Middleware
    app.use(express.json());

    // Auth Lite Middleware
    const limiter = createRateLimiter({
        limit: 5,
        windowMs: 60_000,
    });
    app.use(createAuthMiddleware({
        apiKey: env.API_KEY,
        limiter,
        now
    }));

    // Inject dependencies into context / custom middleware if routes need them
    app.use((req, res, next) => {
        req.db = dbClient;
        next();
    });

    // Attach application routes
    app.use('/', router);

    // Unmatched routes -> 404 envelope, then the central error handler last.
    app.use(routeNotFoundHandler);
    app.use(errorHandlerMiddleware);

    return app;
}
