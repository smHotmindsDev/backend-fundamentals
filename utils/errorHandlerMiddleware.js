import ServerError from './ServerError.js'
import logger from "./logger.js";

const errorHandlerMiddleware = (err, req, res, next) => {
    // Default to 500 if no status code is provided
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    if (err.isOperational) {
        // Log the error for debugging
        logger.error(`ERROR 💥: ${err.message}`);

        res.status(err.statusCode).json({
            status: err.status,
            message: err.message,
        });
    } else {
        // noinspection JSCheckFunctionSignatures
        logger.error({ err: err }, 'An unexpected error occurred');

        res.status(err.statusCode).json({
            status: err.status,
            message: 'An unexpected error occurred',
        });
    }
};

export default errorHandlerMiddleware;