# API Error Envelope
A single error envelope is provided for the entire API.

```json
{
  "title": "ApiErrorEnvelope",
  "type": "object",
  "required": [
    "statusCode",
    "error",
    "message",
    "requestId"
  ],
  "properties": {
    "statusCode": {
      "type": "integer",
      "enum": [
        400,
        401,
        404,
        409,
        422,
        429,
        500
      ]
    },
    "error": {
      "type": "string",
      "enum": [
        "bad_request",
        "invalid_auth",
        "not_found",
        "conflict",
        "validation_error",
        "rate_limit_error",
        "internal_error"
      ]
    },
    "message": {
      "type": "string"
    },
    "requestId": {
      "type": "string",
      "format": "uuid"
    },
    "details": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "field",
          "code",
          "message"
        ],
        "properties": {
          "field": {
            "type": "string"
          },
          "code": {
            "type": "string",
            "enum": [
              "required",
              "invalid_type",
              "invalid_format",
              "out_of_range",
              "unknown_field"
            ]
          },
          "message": {
            "type": "string"
          }
        },
        "additionalProperties": false
      }
    }
  },
  "additionalProperties": false
}
```

The `statusCode` should be used to compare the HTTP status.
The `requestId` is a server-generated UUID v4, present in every error response and echoed in the X-Request-Id response header. The same value appears in every log record for that request. An incoming X-Request-Id from the client is ignored — the server always generates its own, so a client cannot forge or collide log identifiers.
The `requestId` is non-deterministic, so test assertions cannot perform a deep equality check on the body; instead, compare `statusCode`, `error`, and `message`, while validating the `requestId` against a regular expression and matching it with the `X-Request-Id` header.

## Error types
* **bad_request**: Protocol level error: incorrect `Content-Type`, unparseable JSON, or invalid query parameter.
* **invalid_auth**: Key is missing or invalid.
* **not_found**: Unknown resource or unknown ID in the request body.
* **conflict**: Database state prevents the operation (e.g., no available copies, copy already occupied).
* **validation_error**: JSON is valid but fails semantic validation; the only case containing `details`.
* **rate_limit_error**: Key rate limit exceeded.
* **internal_error**: Unexpected error; message is always static.