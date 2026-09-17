import ServerError from './ServerError.js';

export function createAuthMiddleware({apiKey, limiter, now = Date.now}) {
    return (req, res, next) => {
        const provided = req.headers['x-api-key'];
        const currentTime = now();

        if (!provided || provided !== apiKey) {
            return next(ServerError.invalidAuth());
        }

        const { allowed, entry } = limiter.consume(apiKey, currentTime);

        if (!allowed) {
            const retryAfter = Math.ceil((entry.resetTime - currentTime) / 1000);
            res.setHeader('Retry-After', retryAfter);
            return next(ServerError.rateLimit());
        }

        return next();
    };
}