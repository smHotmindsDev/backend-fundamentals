import ServerError from "./ServerError.js";
const routeNotFoundHandler = (req, res, next) => {
    next(new ServerError(`Can't find '${req.originalUrl}' on this server!`, 404))
}
export default routeNotFoundHandler;