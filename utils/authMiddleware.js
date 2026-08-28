import ServerError from "./ServerError.js";
import { env } from "../express-server.js";

const authMiddleware = (req, res, next, env) => {
    const method = req.method;

    if (method === 'GET') {
        const token = req.headers.authorization;

        if (!token) {
            return res.status(403).json({ message: 'invalid token' });
            next(new ServerError(`Invalid token`, 403))
        }

        if (token === env?.DEMO_JWT) {
            next();
        } else {
            next(new ServerError(`Uncorrected token`, 401))
        }
    } else {
        next()
    }
};

export default authMiddleware;