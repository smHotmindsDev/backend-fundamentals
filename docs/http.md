## What is
HTTP Request is message from client (browser, application etc) to server. It contains a request to retrieve data or perform an action.

## Structure of request
An HTTP request  consists of a request line, headers, body (optional).
Requests can be sent using cli-tool "curl".

### Analize HTTP Requests
See raw requests using curl or DevTools (Network > Headers > checkbox "Raw").

Example, simple verbose log
```zsh
martin@MacBook-Air-Martin backend-fundamentals % curl -v -X POST http://127.0.0.1:8000/login \
  -H 'Content-Type: application/json' \
  -d '{"usernamse":"James Bond","passworddddd":"1953"}'
Note: Unnecessary use of -X or --request, POST is already inferred.
*   Trying 127.0.0.1:8000...
* Connected to 127.0.0.1 (127.0.0.1) port 8000
> POST /login HTTP/1.1
> Host: 127.0.0.1:8000
> User-Agent: curl/8.7.1
> Accept: */*
> Content-Type: application/json
> Content-Length: 48
>
* upload completely sent off: 48 bytes
< HTTP/1.1 400 Bad Request
< Content-Type: application/json
< Content-Length: 54
< Cache-Control: max-age=604800
< Date: Thu, 20 Aug 2026 16:46:17 GMT
< Connection: keep-alive
< Keep-Alive: timeout=5
<
* Connection #0 to host 127.0.0.1 left intact
{"status":400,"message":"Incorrect or empty username"}%    
```

Example, detail trace-log with using `curl --trace` in hex:
```
== Info:   Trying 127.0.0.1:8000...
== Info: Connected to 127.0.0.1 (127.0.0.1) port 8000
=> Send header, 134 bytes (0x86)
0000: 50 4f 53 54 20 2f 6c 6f 67 69 6e 20 48 54 54 50 POST /login HTTP
0010: 2f 31 2e 31 0d 0a 48 6f 73 74 3a 20 31 32 37 2e /1.1..Host: 127.
0020: 30 2e 30 2e 31 3a 38 30 30 30 0d 0a 55 73 65 72 0.0.1:8000..User
0030: 2d 41 67 65 6e 74 3a 20 63 75 72 6c 2f 38 2e 37 -Agent: curl/8.7
0040: 2e 31 0d 0a 41 63 63 65 70 74 3a 20 2a 2f 2a 0d .1..Accept: */*.
0050: 0a 43 6f 6e 74 65 6e 74 2d 54 79 70 65 3a 20 61 .Content-Type: a
0060: 70 70 6c 69 63 61 74 69 6f 6e 2f 6a 73 6f 6e 0d pplication/json.
0070: 0a 43 6f 6e 74 65 6e 74 2d 4c 65 6e 67 74 68 3a .Content-Length:
0080: 20 30 0d 0a 0d 0a                                0....
```

### Headers
Headers carry metadata about the request. Example, Content-Type, Content-Length or Cache-Control.

#### Content-Type
The HTTP Content-Type header is type of the request body (e.g. "application/octet-stream", "application/json").

#### Content-Length
The HTTP Content-Length header indicates the size, in bytes, of the message body sent to the recipient. 

In HTTP/1.0, it is required.
In HTTP/2, Content-Length is still included for backwards compatibility.

Example, dynamic calculation of Content-Length
```js
  const responseData = JSON.stringify({ status: status, message: message });
  const contentLength = Buffer.byteLength(responseData, 'utf8');
```

#### Cache-Control
The HTTP Cache-Control header has directives (instructions) that control caching in browsers and shared caches.
