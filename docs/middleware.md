# Middleware in Express
## What happens if a middleware does not call next()
If a middleware does not call `next()`, Express runs it but does not move on to the next function. For the user, this means the request "hangs".

Only this one request hangs, not the whole server. The event loop is free, so Node still handles other requests.

Node does not close such a request by default (`server.timeout` is `0`), so it hangs until the client or a proxy in front of the server gives up. Until then it holds its socket and memory. If the middleware took a connection from the DB pool and did not release it, the pool runs out, and then every request that needs the DB hangs.

A middleware must do one of two things:
- call `next()` (or `next(err)`), or
- send the response itself, for example `res.status(401).json(...)`. Then not calling `next()` is correct: the chain ends here on purpose.

Neither: the request hangs. Both: a later layer tries to send a second response and fails with `ERR_HTTP_HEADERS_SENT` ("Cannot set headers after they are sent").

Onion (`/members`):
```
                             A            A    B        C                C
                             ▼            ▲    ▼        ▼                ▲
╭────────────────────────────▼────────────▲────▼────────▼────────────────▲───────────╮
│ MW1 (logger)               │            │    │        │                │           │
│  ╭─────────────────────────▼────────────▲────▼────────▼────────────────▲────────╮  │
│  │ MW2 (express.json())    │            │    │        │                │        │  │
│  │  ╭──────────────────────▼────────────▲────▼────────▼────────────────▲─────╮  │  │
│  │  │ MW3 (auth)           │            │    │        │                │     │  │  │
│  │  │                      │            │    ■ hangs  │ next(err)      │     │  │  │
│  │  │  ╭───────────────────▼────────────▲───────╮  ╭──▼────────────────▲──╮  │  │  │
│  │  │  │ MW4 (dbClient)    │            │       │  │  ╰▶ errorHandler ─╯  │  │  │  │
│  │  │  │  ╭────────────────▼────────────▲────╮  │  ╰──────────────────────╯  │  │  │
│  │  │  │  │ MW5 (counter)  │            │    │  │                            │  │  │
│  │  │  │  │  ╭─────────────▼────────────▲─╮  │  │                            │  │  │
│  │  │  │  │  │             ╰▶ Handler ──╯ │  │  │                            │  │  │
│  │  │  │  │  ╰────────────────────────────╯  │  │                            │  │  │
│  │  │  │  ╰──────────────────────────────────╯  │                            │  │  │
│  │  │  ╰────────────────────────────────────────╯                            │  │  │
│  │  ╰────────────────────────────────────────────────────────────────────────╯  │  │
│  ╰──────────────────────────────────────────────────────────────────────────────╯  │
╰────────────────────────────────────────────────────────────────────────────────────╯
```
- A: normal path. Every layer calls next(). The handler sends the response.
- B: if authMiddleware did not call next() and did not send a response, the request would stop here and hang. MW4, MW5
  and the handler would never run. The logger would not write its completion line either: pino-http writes it when the
  response is sent, on the way back out (▲), and path B never comes back.
- C: authMiddleware calls next(err). Express skips every normal middleware and route after it (MW4, MW5, the handler,
  routeNotFoundHandler) and goes to errorHandlerMiddleware, the last middleware in the chain. It sends the response.

## Why `return next()`
`next()` is an ordinary function call. It hands the request to the next layer and then returns into the current function. It does not stop the code below it:
```js
if (!token) {
    next(ServerError.invalidAuth()); // no return
}
next(); // still runs: the same request goes down two paths
```
That is why every branch in `authMiddleware` ends with `return next(...)`.
