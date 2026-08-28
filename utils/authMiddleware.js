const authMiddleware = (req, res, next) => {
    const method = req.method;

    if (method === 'GET') {
        const token = req.headers.authorization;

        if (!token) {
            return res.status(403).json({ message: 'invalid token' });
        }

        if (token === env?.DEMO_JWT) {
            next();
        } else {
            return res.status(401).json({ message: 'uncorrected token' });
        }
    } else {
        next()
    }
};

export default authMiddleware;