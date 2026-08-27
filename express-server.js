// TODO A4. Errors, validation, config
// - Zod validation on all inputs; malformed JSON → clean 422, never a crash.
// - Central error handler: operational errors (404, validation) vs programmer errors (bugs) — different handling, different logging.
// - Env config validated at boot; server refuses to start with missing config.
// - Process-level safety: what happens on an unhandled promise rejection? Make it crash loudly, then discuss why crashing is correct.
// - **🤖 AI-OK:** Zod syntax reference.
// - **🧠 Manual-only:** operational-vs-programmer error design, boot validation logic.

import express from 'express';
import * as fs from 'node:fs';
import { createReadStream } from 'node:fs';
import * as z from "zod";

const app = express();
const port = 8000;
const lorem100mbJson = "./lorem-100mb.json";
const lorem500mbJson = "./lorem-500mb.json";

const User = z.object({
  username: z.string(),
  password: z.string()
});

const validateUser = (username, password) => {
  try {
    User.parse({ username: username, password: password });
    return {
      success: true,
    };
  } catch(error){
    if(error instanceof z.ZodError){
      console.error(error.issues)
      return { success: false, error: error.issues };
    }

    return { success: false, error: 'Internal error' };
  }
}

const JsonInputText = z.object({
  data: z.object({
    text: z.string()
  })
})

const validateLoremJson = (data) => {
  try {
    JsonInputText.parse({ data: data });
    return {
      success: true,
    };
  } catch(error){
    if(error instanceof z.ZodError){
      console.error(error.issues)
      return { success: false, error: error.issues };
    }

    return { success: false, error: 'Internal error' };
  }
}

const sendLoremJsonResult = (res, isValid, payload) => {
  if (isValid.success) {
    return res.status(200).json(payload)
  } else {
    return res.status(422).json({
      "status": "invalid json",
      "message" : isValid.error
    })
  }
}

app.use(express.json());

const requestLoggerMiddleware = (req, res, next) => {
  req.time = new Date(Date.now()).toString();
  console.log(req.method,req.hostname, req.path, req.time);
  next();
}

app.use(requestLoggerMiddleware);

const authMiddleware = (req, res, next) => {
  const method = req.method;

  if (method === 'GET') {
    const token = req.headers.authorization;

    if (!token) {
        return res.status(403).json({ message: 'invalid token' });
      }

    if (token === process.env.DEMO_JWT) {
      next();
    } else {
      return res.status(401).json({ message: 'uncorrected token' });
    }
  } else {
    next()
  }
};

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
    if (username === process.env.DEMO_USERNAME && password === process.env.DEMO_PASSWORD) {
      return res.status(200).json({
        "status": "success",
        "token": process.env.DEMO_JWT,
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

const errorHandlerMiddleware = (err, req, res, next) => {
  console.error(err.stack);

  console.error(err.stack);
  res.status(500).send('Something broke!');
}

app.use(errorHandlerMiddleware);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
