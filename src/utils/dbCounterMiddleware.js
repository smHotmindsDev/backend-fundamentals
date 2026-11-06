export function dbCounterMiddleware(req, res, next) {
    const db = req.db;

    let calls = 0;

    req.db = {
        query(...args) {
            calls++;
            return db.query(...args);
        },
    };

    res.on('finish', () => {
        req.log.info({ dbCalls: calls }, 'db calls');
    });

    next();
}
