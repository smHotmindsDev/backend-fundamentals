import express from 'express';
import * as fs from 'node:fs';
import { createReadStream } from 'node:fs';
import * as path from 'node:path';

const app = express();
const port = 8000;
const lorem100mbJson = "./lorem-100mb.json";
const lorem500mbJson = "./lorem-500mb.json";

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
  const data = JSON.parse(json)

  const finish = new Date();
  const duration = finish.getTime() - start.getTime();
  console.log(`json-parse FINISH at ${finish.getTime()}, took ${duration}ms`);

  res.send({ start: start, finish: finish, duration: duration });
})

app.get('/await-timer', async (req, res) => {
  const start = Date.now();
  console.log(`await-timer START at ${start}`)

  // Bugs code
  // const finish = setTimeout(async () => {
  //   return new Date();
  // }, 5000)

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
  const data = JSON.parse(json)

  const finish = new Date();
  const duration = finish.getTime() - start.getTime();
  console.log(`read-sync FINISH at ${finish.getTime()}, took ${duration}ms`);

  res.send({ start: start, finish: finish, duration: duration });
})

app.get('/read-stream', (req, res) => {
  let chunksReceived = 0;

});

app.post('/login', (req, res) => {
  const { username, password } = req.body;


  if (!username || !password) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }

  if (username === process.env.DEMO_USERNAME && password === process.env.DEMO_PASSWORD) {
    return res.status(200).json({
      "status": "success",
      "token": process.env.DEMO_JWT,
      "token_type": "Bearer",
    })
  } else {
    return res.status(403).json({
      "status": "false"
    })
  }
})

const errorHandlerMiddleware = (err, req, res, next) => {
  console.error(err.stack);

  console.error(err.stack);
  res.status(500).send('Something broke!');

  next();
}

app.use(errorHandlerMiddleware);

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
