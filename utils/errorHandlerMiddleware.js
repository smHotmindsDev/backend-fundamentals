const errorHandlerMiddleware = (err, req, res) => {
    console.error(err.stack);

    console.error(err.stack);
    res.status(500).send('Something broke!');
}

export default errorHandlerMiddleware;