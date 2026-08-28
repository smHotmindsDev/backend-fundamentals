// TODO A4. Errors, validation, config
// - Central error handler: operational errors (404, validation) vs programmer errors (bugs) — different handling, different logging.
// - Process-level safety: what happens on an unhandled promise rejection? Make it crash loudly, then discuss why crashing is correct.
// - **🤖 AI-OK:** Zod syntax reference.
// - **🧠 Manual-only:** operational-vs-programmer error design, boot validation logic.

import express from 'express';
import * as fs from 'node:fs';
import { createReadStream } from 'node:fs';
import validateUser from "./utils/validateUser.js";
import validateEnv from "./utils/validateEnv.js";
import validateLoremJson from "./utils/validateLoremJson.js";
import sendLoremJsonResult from "./utils/sendLoremJsonResult.js";
import requestLoggerMiddleware from "./utils/requestLoggerMiddleware.js";
import authMiddleware from "./utils/authMiddleware.js";
import routeNotFoundHandler from "./utils/routeNotFoundHandler.js";
import errorHandlerMiddleware from "./utils/errorHandlerMiddleware.js";

const app = express();
const port = 8000;
const lorem100mbJson = "./lorem-100mb.json";
const lorem500mbJson = "./lorem-500mb.json";

const isValidEnv = validateEnv(process.env);
const env = isValidEnv.env ? isValidEnv.env : null;

app.use(express.json());
app.use(requestLoggerMiddleware);

// Temporary off
// app.use(authMiddleware)

app.get('/', async (req, res) => {
  res.send("Hello Work")
});

app.get('/json-parse-100mb', (req, res) => {
  const start = new Date();
  console.log(`json-parse START at ${start.getTime()}`)

  const json = fs.readFileSync(lorem100mbJson, 'utf8');
  const data = JSON.parse(json);
  const isValid = validateLoremJson(data);

  const finish = new Date();
  const duration = finish.getTime() - start.getTime();
  console.log(`json-parse FINISH at ${finish.getTime()}, took ${duration}ms, json ${isValid.success ? 'valid' : 'invalid'}`);

  const payload = {start, finish, duration};
  sendLoremJsonResult(res, isValid, payload);
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

app.get('/read-sync', (req, res) => {
  const start = new Date();
  console.log(`read-sync START at ${start.getTime()}`)

  const json = fs.readFileSync(lorem500mbJson, 'utf8');
  const data = JSON.parse(json);
  const isValid = validateLoremJson(data);

  const finish = new Date();
  const duration = finish.getTime() - start.getTime();
  console.log(`read-sync FINISH at ${finish.getTime()}, took ${duration}ms`);

  const payload = {start, finish, duration};
  sendLoremJsonResult(res, isValid, payload);
})

app.get('/read-stream', (req, res) => {
  let chunksReceived = 0;
  let data = "";

  const start = new Date();
  console.log(`read-stream START at ${start.getTime()}`)

  const stream = createReadStream(lorem500mbJson, { encoding: 'utf8' });

  stream.on('data', (chunk) => {
    data += chunk;
    chunksReceived++;
  });

  stream.on('end', () => {
    console.log('Finished reading file.');
    const isValid = validateLoremJson(JSON.parse(data));

    const finish = new Date();
    const duration = finish.getTime() - start.getTime();
    console.log(`read-stream FINISH at ${finish.getTime()}, took ${duration}ms`);

    const payload = {start, finish, duration};
    sendLoremJsonResult(res, isValid, payload);
  });

  stream.on('error', (err) => {
    console.error('An error occurred:', err.message);
  });
})

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const isValid = validateUser(username, password);

  if (isValid.success) {
    if (username === env?.DEMO_USERNAME && password === env?.DEMO_PASSWORD) {
      return res.status(200).json({
        "status": "success",
        "token": env?.DEMO_JWT,
        "token_type": "Bearer",
      })
    } else {
      return res.status(401).json({
        "status": "false",
        "message": "Username or password incorrect"
      })
    }
  } else {
    return res.status(400).json({
      "status": "false",
      "message" : isValid.error
    })
  }
})

app.use(routeNotFoundHandler);
app.use(errorHandlerMiddleware);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});

// Start the server
if (isValidEnv.success) {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}