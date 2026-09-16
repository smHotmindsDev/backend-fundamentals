import ServerError from './ServerError.js';

export function createAuthMiddleware({ apiKey }) {
    const RATE_LIMIT = 5;
    const RATE_WINDOW_MS = 60000;
    // apiKey -> { remaining, resetTime }
    const rateLimitStore = new Map();

    function consume(apiKey, now) {
        let entry = rateLimitStore.get(apiKey);

        // Lazy check: no entry or window expired -> open a new window
        if (!entry || now >= entry.resetTime) {
            entry = { remaining: RATE_LIMIT, resetTime: now + RATE_WINDOW_MS };
            rateLimitStore.set(apiKey, entry);
        }

        if (entry.remaining === 0) return { allowed: false, entry };

        entry.remaining--;
        return { allowed: true, entry };
    }

    // Periodic sweep: remove expired windows once per window
    setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of rateLimitStore) {
            if (now >= entry.resetTime) rateLimitStore.delete(key);
        }
    }, RATE_WINDOW_MS).unref();

    return (req, res, next) => {
        const provided = req.headers['x-api-key'];

        if (!provided || provided !== apiKey) {
            return next(ServerError.invalidAuth());
        }

        const now = Date.now();
        const { allowed, entry } = consume(apiKey, now);

        if (!allowed) {
            const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
            res.setHeader('Retry-After', retryAfter);
            return next(ServerError.rateLimit());
        }

        return next();
    };
}