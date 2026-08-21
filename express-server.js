import express from 'express';

const app = express();
const port = 8000;

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

app.use(authMiddleware)

app.get('/', (req, res) => {
  res.send('Hello World!')
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
