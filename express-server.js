// TODO A4. Errors, validation, config
// - Central error handler: operational errors (404, validation) vs programmer errors (bugs) — different handling, different logging.
// - Process-level safety: what happens on an unhandled promise rejection? Make it crash loudly, then discuss why crashing is correct.
// - **🤖 AI-OK:** Zod syntax reference.
// - **🧠 Manual-only:** operational-vs-programmer error design, boot validation logic.

import express from 'express';
import * as fs from 'node:fs';
import logger from "./src/utils/logger.js";
import validateUserMiddleware from "./src/utils/validateUserMiddleware.js";
import validateEnv from "./src/utils/validateEnv.js";
import requestLoggerMiddleware from "./src/utils/requestLoggerMiddleware.js";
import authMiddleware from "./src/utils/authMiddleware.js";
import routeNotFoundHandler from "./src/utils/routeNotFoundHandler.js";
import errorHandlerMiddleware from "./src/utils/errorHandlerMiddleware.js";
import validateLoremJsonMiddleware from "./src/utils/validateLoremJsonMiddleware.js";
import ServerError from "./src/utils/ServerError.js";
import readFileSyncMiddleware from "./src/utils/readFileSyncMiddleware.js";
import readStreamMiddleware from "./src/utils/readStreamMiddleware.js";

const app = express();
const port = 8000;
const lorem100mbJson = "./lorem-100mb.json";
const lorem500mbJson = "./lorem-500mb.json";

const isValidEnv = validateEnv(process.env);
export const env = isValidEnv.env ? isValidEnv.env : null;

app.use(express.json());

app.use(requestLoggerMiddleware);

app.get('/', authMiddleware, (req, res) => {
  res.send("Hello Work")
});

app.get('/json-parse-100mb', readFileSyncMiddleware(lorem100mbJson), validateLoremJsonMiddleware, (req, res) => {
  res.send("Done")
})

app.get('/await-timer', async (req, res) => {
  const start = Date.now();
  console.log(`await-timer START at ${start}`);

  await new Promise(resolve => setTimeout(resolve, 5000));

  const finish = Date.now();
  const duration = finish - start;
  console.log(`await-timer FINISH at ${finish}, took ${duration}ms`);

  res.send({ start: start, finish: finish, duration: duration});
})

app.get('/read-sync', readFileSyncMiddleware(lorem500mbJson), validateLoremJsonMiddleware, (req, res) => {
  res.send("Done")
})

app.get('/read-stream', readStreamMiddleware(lorem500mbJson), validateLoremJsonMiddleware, (req, res, next) => {
  res.send("Done")
})

app.post('/login', validateUserMiddleware,(req, res, next) => {
  const {username, password} = req.validUser;

  if (username === env?.DEMO_USERNAME && password === env?.DEMO_PASSWORD) {
    return res.status(200).json({
      "status": "success",
      "token":env?.DEMO_JWT,
      "token_type": "Bearer",
    })
  } else {
    next(new ServerError(`Username or password incorrect`, 401))
  }
})

app.use(routeNotFoundHandler);
app.use(errorHandlerMiddleware);
// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  logger.fatal(
      { name: err.name, message: err.message }, 'UNHANDLED REJECTION! 💥 Shutting down...');
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  logger.fatal(
      { name: err.name, message: err.message }, 'UNCAUGHT EXCEPTION! 💥 Shutting down...');
  process.exit(1);
});

// Start the server
if (isValidEnv.success) {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}
