const routeNotFoundHandler = (req, res, next) => {
    res.status(404).send("Sorry, can't find that!");

    next();
}

export default routeNotFoundHandler;