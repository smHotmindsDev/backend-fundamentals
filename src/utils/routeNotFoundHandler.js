// Catch-all for unmatched routes. Mount after every route, before the error handler.
import ServerError from './ServerError.js';

const routeNotFoundHandler = (req, res, next) => {
    next(ServerError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
};

export default routeNotFoundHandler;
