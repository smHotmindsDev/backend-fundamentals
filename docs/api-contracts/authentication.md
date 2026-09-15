# Authentication

The API uses API keys for authorization.
An API key is a token provided by the client when making API requests.
The key is passed exclusively in the request header.
This rule applies to all endpoints; error codes 401 and 429 are not repeated in the error lists for each individual endpoint.

Example,

```
GET /something HTTP/1.1
X-API-Key: abcdef12345
```

X-API-Key was chosen because the Bearer semantics (an OAuth2 access token with expiry/refresh) do not fit the use case—here, we are dealing with a static, long-lived key rather than an issued session.

## Success
If successful, the query execution continues and the success endpoint is applied.

## Errors

If requests with missing or invalid `X-API-Key`:

Header
```http request
HTTP/1.1 401 Unauthorized
Content-Type: application/json
```

Body
```json
{
  "statusCode": 401,
  "error": "invalid_auth",
  "message": "No valid API key provided",
  "requestId": "3f9a1c2e-5b47-4e8d-9b21-7c6d0f4a8e13"
}
```
The requestId value in examples is illustrative; every response carries a fresh UUID.

If `X-API-Key` is valid, but per-key request limit exhausted:

Header
```http request
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
```
Body
```json
{
  "statusCode": 429,
  "error": "rate_limit_error",
  "message": "Rate limit exceeded.",
  "requestId": "3f9a1c2e-5b47-4e8d-9b21-7c6d0f4a8e13"
}

```
The requestId value in examples is illustrative; every response carries a fresh UUID.

Error message does not distinguish missing vs invalid key, to avoid key-enumeration.

## Rate Limit
Use per-key rate limit in memory.

Rate limiting parameters: maximum of 5 requests per minute.

A compromise solution: if the process restarts, the counters are reset; if you run multiple server instances (horizontal scaling), each has its own separate map, and the effective limit for a client becomes "limit × number of instances" because they do not share state.

In-memory storage uses Map object for rate limiter store.
Structure of a Map object:
- **Key:** apiKey ( from X-API-Key header)
- **Value:** Object {remaining, resetTime}
    - **remaining:** remaining number of requests (starts at 5 and decreases to 0)
    - **resetTime:** Unix timestamp (in milliseconds) when the limit resets to 5 (`resetTime` = creating + 60s — is fixed window)

The removal of outdated data is implemented using a combination of two methods:
- lazy check
- periodic sweep — every 60 s (one window; an entry cannot go stale sooner, so sweeping more often only yields empty passes)
    - use with .unref() method for prevents the Node.js process from hanging in memory due to an active timer

If the key does not exist or is invalid, we immediately return a 401 Unauthorized response. We do not consume the limit or create Map entries for junk or random keys, so as not to clutter memory.
If the key is valid, we check its limit in memory. If `remaining > 0`, we decrement the limit and allow the request to proceed. If `remaining === 0` (and the `resetTime` has not yet been reached), we return a "429 Too Many Requests" response.
