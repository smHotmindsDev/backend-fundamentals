class ServerError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true; // Identifies expected vs unexpected runtime errors

        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = ServerError;
