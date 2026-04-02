# Users API Contract

This file focuses on user profile retrieval endpoint. Other account lifecycle endpoints are documented in auth contract.

## GET /api/auth/users/:userId

Auth: Public

Success example:

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "_id": "userId",
    "fullName": "John Doe",
    "userName": "john_doe",
    "email": "john@example.com",
    "profilePicture": "https://...",
    "status": "online"
  }
}
```

Status matrix: 200 success, 404 user not found, 500 server error

## Related Protected User Endpoints

These routes are implemented under /api/auth and covered in auth contract:

- GET /api/auth/me
- PUT /api/auth/profile
- POST /api/auth/logout
- DELETE /api/auth/account
