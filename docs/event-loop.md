JavaScript backends are commonly built on Node.js, although alternatives exist, such as Deno.

Node.js runs JavaScript in a single thread. To handle blocking operations (I/O, file system) without blocking that thread, Node.js relies on a C++ library called libuv. libuv doesn't make JavaScript multithreaded — the JS code itself always runs on one thread — but it offloads blocking work using OS-level async mechanisms (for network I/O) and a thread pool (for file system, DNS, and some crypto operations), so the main thread stays free to keep running JS.

The event loop is the mechanism that continuously checks whether there is code ready to execute, and runs it on the main thread. It works in conjunction with libuv: libuv notifies the event loop when a blocking operation has completed, and the event loop schedules the corresponding callback to run.

*The call stack* is a data structure that holds synchronous code. It follows the LIFO (last-in, first-out) principle. While the call stack is executing synchronous code, all other operations wait in their respective queues.

Not all asynchronous code is treated equally. The runtime splits it into two separate types of queues, heavily favoring microtasks:
- microtask queue
  - process.nextTick — a Node.js-specific queue, implemented at the runtime level (not part of libuv or V8); processed with the *highest priority* of all queues
  - promises (.then/.catch/await) — part of the ECMAScript standard, implemented in V8
- macrotask queue — a set of queues processed in a fixed order:
  - timers (setTimeout, setInterval)
  - pending callbacks
  - poll (I/O)
  - check (setImmediate)
  - close callbacks

After each individual callback from the macrotask queue, the entire microtask queue is drained (first process.nextTick, then promise microtasks) before the event loop moves on to the next macrotask callback.

## Answers to questions
> *Route that does JSON.parse of a 100MB string vs a route that awaits a 5s timer. Hit both with parallel requests. Which blocks the whole server? Why?*

`JSON.parse` is a synchronous, CPU-bound operation. When called, it runs directly on the call stack and blocks it entirely until parsing finishes — during that time, the event loop cannot process anything else, including other incoming requests.

5-second timer will be created using `setTimeout` which is a asynchronous macro task (timer phase).

---

> *setTimeout(fn, 0) vs setImmediate vs process.nextTick vs a resolved promise — predict the order, then run it.*

`process.nextTick` > `resolved promise` > `setImmediate` > `setTimeout(fn, 0)`

If you move the two calls within an I/O cycle, the immediate callback is always executed first.
If we run the following script which is not within an I/O cycle (i.e. the main module), the order in which the two timers are executed is non-deterministic

---

> *Read a big file with readFileSync vs streams inside a request handler; measure impact on other requests.*

`readFileSync` is a synchronous operation that blocks the call stack for the entire duration of the file read.

`streams` are asynchronous and built on EventEmitter. The actual file read, separate from the main thread, and the file is loaded gradually, in chunks. Each ready chunk is delivered back to the main thread as a separate callback.
