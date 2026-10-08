import express from 'express';
import { topBooksRouter } from './routes/topBooks.js';
import { loansRouter } from './routes/loans.js';
import { booksRouter } from './routes/books.js';
import requestLoggerMiddleware from './utils/requestLoggerMiddleware.js';
import { createAuthMiddleware } from './utils/authMiddleware.js';
import { createRateLimiter } from './utils/rateLimiter.js';
import routeNotFoundHandler from './utils/routeNotFoundHandler.js';
import errorHandlerMiddleware from './utils/errorHandlerMiddleware.js';

export function createApp({ env, dbClient, now = Date.now }) {
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
    app.use(
        createAuthMiddleware({
            apiKey: env.API_KEY,
            limiter,
            now,
        }),
    );

    // Inject dependencies into context / custom middleware if routes need them
    app.use((req, res, next) => {
        req.db = dbClient;
        next();
    });

    // Attach application routes
    app.get('/', (req, res) => {
        return res.status(200).json({ status: 'ok' });
    });
    app.use('/reports/top-books', topBooksRouter);
    app.use('/loans', loansRouter);
    app.use('/books', booksRouter);

    // Unmatched routes -> 404 envelope, then the central error handler last.
    app.use(routeNotFoundHandler);
    app.use(errorHandlerMiddleware);

    return app;
}
