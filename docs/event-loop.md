JavaScript backends are commonly built on Node.js, although alternatives exist, such as Deno.

Node.js runs JavaScript in a single thread. To handle blocking operations (I/O, file system) without blocking that thread, Node.js relies on a C++ library called libuv. libuv doesn't make JavaScript multithreaded — the JS code itself always runs on one thread — but it offloads blocking work using OS-level async mechanisms (for network I/O) and a thread pool (for file system, DNS, and some crypto operations), so the main thread stays free to keep running JS.

The event loop is the mechanism that continuously checks whether there is code ready to execute, and runs it on the main thread. It works in conjunction with libuv: libuv notifies the event loop when a blocking operation has completed, and the event loop schedules the corresponding callback to run.

*The call stack* is a data structure that holds synchronous code. It follows the LIFO (last-in, first-out) principle. While the call stack is executing synchronous code, all other operations wait in their respective queues.

Not all asynchronous code is treated equally. The runtime splits it into two separate types of queues, heavily favoring microtasks:
- microtask queue
  - process.nextTick — a Node.js-specific queue, implemented at the runtime level (not part of libuv or V8). When Node drains the queues, this queue runs first. In the body of an ESM module it does not.
  - promises (.then/.catch/await) — part of the ECMAScript standard, implemented in V8
- macrotask queue — a set of queues processed in a fixed order:
  - timers (setTimeout, setInterval)
  - pending callbacks
  - poll (I/O)
  - check (setImmediate)
  - close callbacks

After each callback from the macrotask queue, Node drains the microtask queues before the next macrotask. It runs `process.nextTick` first, then promise callbacks (`.then`, `.catch`, `await`). This order is the same in CommonJS and inside a later callback in an ESM file, for example I/O or `setImmediate`. The body of an ESM module is the exception. V8 is already draining the microtask queue there, so a resolved promise from the module body runs before `process.nextTick`.

## Answers to questions
> *Route that does JSON.parse of a 100MB string vs a route that awaits a 5s timer. Hit both with parallel requests. Which blocks the whole server? Why?*

### Prediction
`JSON.parse` is a synchronous, CPU-bound operation. When called, it runs directly on the call stack and blocks it entirely until parsing finishes — during that time, the event loop cannot process anything else, including other incoming requests.

5-second timer will be created using `setTimeout` which is a asynchronous macro task (timer phase).


### Result
Client-side logs:
```zsh
martin@Mac backend-fundamentals % node event-loop-test.old.js
json-parse done at +187ms
await-timer done at +5190ms
```
Server-side logs:
```zsh
GET 127.0.0.1 /json-parse Wed Aug 26 2026 22:22:16 GMT+0300 (Eastern European Summer Time)
json-parse START at 1787772136325
json-parse FINISH at 1787772136467, took 142ms
GET 127.0.0.1 /await-timer Wed Aug 26 2026 22:22:16 GMT+0300 (Eastern European Summer Time)
await-timer START at 1787772136471
await-timer FINISH at 1787772141473, took 5002ms
```

Both results arrived on the server at the same second, but `await-timer` could only start **4ms** after `json-parse` finished.
**Confirmed.** 
`JSON.parse` blocked the server while the process was running, because it synchronously on the call stack.
The event loop couldn't start the `await-timer` request until the stack was free'

---

> *setTimeout(fn, 0) vs setImmediate vs process.nextTick vs a resolved promise — predict the order, then run it.*

### Prediction
`process.nextTick` > `resolved promise` > `setImmediate` > `setTimeout(fn, 0)`

If you move the two calls within an I/O cycle, the immediate callback is always executed first.
If we run the following script which is not within an I/O cycle (i.e. the main module), the order in which the two timers are executed is non-deterministic

### Result
**Partly confirmed.**

In the body of an ESM module, the resolved promise always runs before `process.nextTick`.

In CommonJS, and inside an event-loop callback in ESM (I/O, `setImmediate`), the order is always `process.nextTick` > `resolved promise`.

Apart from the body of an ESM module, the order matches the prediction:
`process.nextTick` > `resolved promise` > `setImmediate` > `setTimeout(fn, 0)`

`setImmediate` before `setTimeout(fn, 0)` is guaranteed only inside an I/O callback: after the poll phase, the next phase is check. In the module body and inside a `setImmediate` callback, these two can change places. `setTimeout(fn, 0)` waits at least 1 ms, and the event loop passes the timers phase before it reaches the next check phase. If 1 ms has already passed, the timeout runs first.

CommonJS Logs:
```aiignore
martin@Mac backend-fundamentals % node event-loop-test.old.cjs
Second Test START on Wed Aug 26 2026 23:04:47 GMT+0300 (Eastern European Summer Time)
Second Test within an I/O cycle START on Wed Aug 26 2026 23:04:47 GMT+0300 (Eastern European Summer Time)
nextTick done at 5ms
Resolved Promise done at 5ms
Immediate done at 5ms
Timeout done at 5ms
nextTick (I/O) done at 26ms
Resolved Promise (I/O) done at 26ms
Immediate (I/O) done at 26ms
Timeout (I/O) done at 26ms
```

ESM Logs:
```aiignore
martin@Mac backend-fundamentals % node event-loop-test.old.js
Second Test START on Wed Aug 26 2026 23:06:26 GMT+0300 (Eastern European Summer Time)
Second Test within an I/O cycle START on Wed Aug 26 2026 23:06:26 GMT+0300 (Eastern European Summer Time)
Resolved Promise done at 4ms
nextTick done at 5ms
Immediate done at 5ms
Timeout done at 5ms
nextTick (I/O) done at 42ms
Resolved Promise (I/O) done at 42ms
Immediate (I/O) done at 42ms
Timeout (I/O) done at 43ms
```

### Why

The order depends on who runs the code.

The body of an ESM module is a microtask. ESM allows `await` at the top level, so Node runs the module body like an async function, inside the microtask queue. V8 is already taking jobs from the microtask queue. A resolved promise from that body goes into the same queue, so it runs before `process.nextTick`. Node drains `process.nextTick` only after that.

The body of a CommonJS module is a normal function call. When the call ends, Node drains the queues. `process.nextTick` runs first, then promises.

An event-loop callback is also a normal call from Node. This is true in ESM and in CommonJS. The callback can come from I/O (the poll phase) or from `setImmediate` (the check phase). When the callback ends, Node drains `process.nextTick` first, then promises.

This matches the Node.js documentation: [When to use `queueMicrotask()` vs. `process.nextTick()`](https://nodejs.org/api/process.html#when-to-use-queuemicrotask-vs-processnexttick). It describes both cases: CommonJS and the ESM module body. The ESM case was added to the docs in January 2025 (Node v20.19.0, v22.14.0, v23.7.0). Older docs showed the same order for both.

### Wrong decisions
First, I formatted the promise in synchronous style, so I got incorrect results

Snippet:
```js
const promize = new Promise((resolve, reject) => {
    const delay = Date.now() - start;
    console.log(`Resolved Promise done at ${delay}ms`);
})
```
Console:
```
martin@Mac backend-fundamentals % node event-loop-test.old.js
Second Test START on Wed Aug 26 2026 22:56:09 GMT+0300 (Eastern European Summer Time)
Resolved Promise done at 4ms
Second Test within an I/O cycle START on Wed Aug 26 2026 22:56:09 GMT+0300 (Eastern European Summer Time)
nextTick done at 4ms
Immediate done at 5ms
Timeout done at 5ms
Resolved Promise done at 75ms
nextTick (I/O) done at 75ms
Immediate (I/O) done at 75ms
Timeout (I/O) done at 76ms
```
---

> *Read a big file with readFileSync vs streams inside a request handler; measure impact on other requests.*
### Prediction
`readFileSync` is a synchronous operation that blocks the call stack for the entire duration of the file read.

`streams` are asynchronous and built on EventEmitter. The actual file read, separate from the main thread, and the file is loaded gradually, in chunks. Each ready chunk is delivered back to the main thread as a separate callback.
### Result
**Confirmed.**

The `readFileSync` process blocked the server during execution, so the request for the home page completed in 965 ms. 

The `streams` process downloaded the file asynchronously in 64 KB chunks, so the request for the home page completed in 2 ms.

Stream logs:
```aiignore
martin@Mac backend-fundamentals % node event-loop-test.old.js
Thirty Test START on Thu Aug 27 2026 00:31:36 GMT+0300 (Eastern European Summer Time)
read-sync start at 1787779896442ms
read-sync done at +965ms
get on homepage parallel with read-sync done at +965ms
read-stream start at 1787779897407ms
get on homepage parallel with read-stream done at +2ms
read-stream done at +413ms
Thirty Test FINISH on Thu Aug 27 2026 00:31:37 GMT+0300 (Eastern European Summer Time), duration = 1388ms
```