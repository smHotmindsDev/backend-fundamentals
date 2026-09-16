import fs from "node:fs";
import { createReadStream } from 'node:fs';
import ServerError from "./ServerError.js";

const readStreamMiddleware = (filePath) => {
    return (req, res, next) => {
        let chunksReceived = 0;
        let rawData = "";

        const stream = createReadStream(filePath, { encoding: 'utf8' });

        stream.on('data', (chunk) => {
            rawData += chunk;
            chunksReceived++;
        });

        stream.on('end', () => {
            req.rawData = rawData;
            next()
        });

        stream.on('error', (err) => {
            next(new ServerError(`An error occurred: ${err.message}`, 500))
        });
    };
}

export default readStreamMiddleware;