import * as z from "zod";
import ServerError from "./ServerError.js";

const JsonInputText = z.object({
    data: z.object({
        text: z.string()
    })
})
const validateLoremJsonMiddleware = (req, res, next) => {
    const data = JSON.parse(req.rawData);
    try {
        req.validData = JsonInputText.parse({ data: data });
        next();
    } catch(error){
        if(error instanceof z.ZodError){
            next(new ServerError(`Invalid JSON: ${JSON.stringify(error.issues)}`, 422))
        }
        next(new ServerError(`An error occurred: ${error.message}`, 500))
    }
}
export default validateLoremJsonMiddleware