import fs from "node:fs";
import ServerError from "./ServerError.js";
const readFileSyncMiddleware = (filePath) => {
    return (req, res, next) => {
        try {
            req.rawData = fs.readFileSync(filePath, 'utf8');
            next()
        } catch (error) {
            next(new ServerError(`An error occurred: ${error.message}`, 500))
        }
    };
}

export default readFileSyncMiddleware