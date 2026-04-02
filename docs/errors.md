# Error Handling

All error responses follow a consistent shape:

{
"success": false,
"message": "Human readable error message"
}

## Common Status Codes

- 400 Bad Request: validation failure or malformed input
- 401 Unauthorized: missing or invalid token
- 403 Forbidden: user authenticated but not allowed
- 404 Not Found: resource does not exist
- 409 Conflict: duplicate email or username
- 429 Too Many Requests: rate limit exceeded
- 500 Internal Server Error: unhandled server issue

## Auth Flow Errors

- Signup/login rate limits are enforced by route-level limiter middleware.
- Password reset returns generic success message where needed to avoid account enumeration.
- Blacklisted tokens are rejected for both REST and Socket authentication.

## Socket Errors

Socket operational errors are emitted through error event payload:

{
"message": "Error description"
}

Typical socket errors:

- Authentication required
- Invalid token
- Not a participant
- Failed to send message
- Cannot edit this message
