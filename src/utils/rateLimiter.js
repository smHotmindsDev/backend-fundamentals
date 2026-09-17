export function createRateLimiter({
                                      limit,
                                      windowMs
}) {
    if (typeof limit !== 'number' || typeof windowMs !== 'number' ) {
        // TODO Refactor with ServerError()
        return 'incorrect type of arguments';
    }

    const store = new Map();

    function consume(apiKey, now) {
        let entry = store.get(apiKey);

        // Lazy check: no entry or window expired -> open a new window
        if (!entry || now >= entry.resetTime) {
            entry = { remaining: limit, resetTime: now + windowMs };
            store.set(apiKey, entry);
        }

        if (entry.remaining === 0) return { allowed: false, entry };

        entry.remaining--;
        return { allowed: true, entry };
    }

    // Periodic sweep: remove expired windows once per window
    setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of store) {
            if (now >= entry.resetTime) store.delete(key);
        }
    }, windowMs).unref();

    return {
        consume
    };
}