# Auth API Contract

Base path: /api/auth

Response envelope:

```json
{
  "success": true,
  "message": "...",
  "data": {}
}
```

## GET /check-username/:username

Request example:

```http
GET /api/auth/check-username/john_doe
```

Success example:

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "isAvailable": true,
    "suggestions": [],
    "message": "Username is available"
  }
}
```

Status matrix: 200 success, 400 invalid username, 500 server error

## POST /signup

Rate limit: 5 requests / 15 minutes

Request example:

```json
{
  "fullName": "John Doe",
  "userName": "john_doe",
  "email": "john@example.com",
  "password": "Strong@123"
}
```

Success example (email send success):

```json
{
  "success": true,
  "message": "Account created! Please verify your email.",
  "data": {
    "user": {
      "id": "userId",
      "fullName": "John Doe",
      "userName": "john_doe",
      "email": "john@example.com",
      "profilePicture": "https://..."
    },
    "message": "Verification email sent! Please check your inbox."
  }
}
```

Status matrix: 201 created, 400 validation error, 409 duplicate email or username, 429 rate limited, 500 server error

## POST /login

Rate limit: 10 requests / 15 minutes

Request example:

```json
{
  "email": "john@example.com",
  "password": "Strong@123"
}
```

Success example:

```json
{
  "success": true,
  "message": "Login successful!",
  "data": {
    "user": {
      "id": "userId",
      "fullName": "John Doe",
      "userName": "john_doe",
      "email": "john@example.com",
      "profilePicture": "https://..."
    },
    "token": "accessToken"
  }
}
```

Status matrix: 200 success, 400 missing input, 401 invalid credentials or unverified user, 429 rate limited, 500 server error

## GET /verify-email/:token

Success example:

```json
{
  "success": true,
  "message": "Email verified! Welcome to Synkro",
  "data": {
    "user": {
      "id": "userId",
      "fullName": "John Doe",
      "userName": "john_doe",
      "email": "john@example.com"
    },
    "token": "accessToken"
  }
}
```

Status matrix: 200 success, 400 invalid or expired token, 500 server error

## POST /resend-verification

Request example:

```json
{
  "email": "john@example.com"
}
```

Success example:

```json
{
  "success": true,
  "message": "Verification email sent!",
  "data": null
}
```

Status matrix: 200 success, 400 not found or already verified, 500 server error

## POST /forgot-password

Rate limit: 3 requests / hour

Request example:

```json
{
  "email": "john@example.com"
}
```

Success example (anti-enumeration):

```json
{
  "success": true,
  "message": "If this email exists, a password reset link has been sent.",
  "data": null
}
```

Status matrix: 200 generic success, 400 missing email, 429 rate limited

## POST /reset-password

Request example:

```json
{
  "token": "resetToken",
  "newPassword": "NewStrong@123"
}
```

Success example:

```json
{
  "success": true,
  "message": "Password reset successful! Please login.",
  "data": null
}
```

Status matrix: 200 success, 400 invalid input or token, 500 server error

## POST /refresh-token

Requires refreshToken cookie.

Success example:

```json
{
  "success": true,
  "message": "Token refreshed",
  "data": {
    "token": "newAccessToken"
  }
}
```

Status matrix: 200 success, 401 invalid or missing refresh token

## POST /logout

Auth: Protected

Success example:

```json
{
  "success": true,
  "message": "Logout successful",
  "data": null
}
```

Status matrix: 200 success, 401 unauthorized, 500 server error

## GET /me

Auth: Protected

Success example:

```json
{
  "success": true,
  "message": "User fetched successfully",
  "data": {
    "id": "userId",
    "fullName": "John Doe",
    "userName": "john_doe",
    "email": "john@example.com",
    "profilePicture": "https://..."
  }
}
```

Status matrix: 200 success, 401 unauthorized, 500 server error

## PUT /profile

Auth: Protected

Request example:

```json
{
  "fullName": "John D",
  "profilePicture": "https://example.com/avatar.jpg"
}
```

Success response example:

```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "id": "userId",
    "fullName": "John D",
    "userName": "john_doe",
    "email": "john@example.com",
    "profilePicture": "https://example.com/avatar.jpg"
  }
}
```

Status matrix: 200 success, 400 validation error, 401 unauthorized, 500 server error

## DELETE /account

Auth: Protected

Request example:

```json
{
  "password": "CurrentPassword@123"
}
```

Success example:

```json
{
  "success": true,
  "message": "Account deleted successfully",
  "data": null
}
```

Status matrix: 200 success, 400 missing password, 401 wrong password or unauthorized, 404 user not found, 500 server error
