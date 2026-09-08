import * as z from "zod";
import ServerError from "./ServerError.js";

const User = z.object({
    username: z.string(),
    password: z.string()
});

const validateUserMiddleware = (req, res, next) => {
    const { username, password } = req.body;

    try {
        req.validUser = User.parse({ username: username, password: password });
        next();
    } catch(error){
        if(error instanceof z.ZodError){
            next(new ServerError(`Invalid username or password: ${JSON.stringify(error.issues)}`, 400))
        }
        next(new ServerError(`An error occurred: ${error.message}`, 500))
    }
}

export default validateUserMiddleware;