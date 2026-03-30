# Synkro Backend

Express + MongoDB backend for Synkro user authentication.

## Features

- User registration with email verification
- Login with JWT access token + refresh token
- Logout with token blacklist
- Forgot/reset password flow
- Profile updates
- Current user and public user lookup
- Rate-limited auth endpoints

## Tech Stack

- Node.js
- Express
- MongoDB + Mongoose
- JWT (`jsonwebtoken`)
- Password hashing (`bcryptjs`)
- Email (`nodemailer`)

## Project Structure

```text
backend/
  src/
    controllers/
    routes/
    middleware/
    models/
    services/
    utils/
    lib/
    server.js
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file in `backend/`.

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/synkro

JWT_SECRET=your_access_token_secret
JWT_REFRESH_SECRET=your_refresh_token_secret

FRONTEND_URL=http://localhost:5173

# Email (choose one strategy)
# Gmail
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-gmail-app-password

# Optional sender override
EMAIL_FROM="Synkro <noreply@synkro.app>"

# OR Ethereal
# USE_ETHEREAL=true
# ETHEREAL_EMAIL=...
# ETHEREAL_PASSWORD=...

# OR custom SMTP
# SMTP_HOST=...
# SMTP_PORT=587
# SMTP_SECURE=false
# SMTP_USER=...
# SMTP_PASS=...
```

3. Start development server:

```bash
npm run dev
```

4. Production run:

```bash
npm start
```

## Base URLs

- API base: `http://localhost:3000/api`
- Auth base: `http://localhost:3000/api/auth`

## Response Shape

All API responses use this structure:

```json
{
  "success": true,
  "message": "...",
  "data": {}
}
```

On errors:

```json
{
  "success": false,
  "message": "..."
}
```

## Authentication Details

- Access token cookie name: `synkroKey`
- Refresh token cookie name: `refreshToken`
- Access token lifetime: 14 days
- Refresh token lifetime: 30 days
- Protected routes accept token from:
  - `Cookie: synkroKey`
  - `Authorization: Bearer <token>`

## User Authentication API

### 1) Check Username Availability

- Method: `GET`
- Path: `/api/auth/check-username/:username`
- Auth: Public

Success `200`:

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

### 2) Sign Up

- Method: `POST`
- Path: `/api/auth/signup`
- Auth: Public
- Rate limit: 5 requests / 15 minutes

Body:

```json
{
  "fullName": "John Doe",
  "userName": "john_doe",
  "email": "john@example.com",
  "password": "Strong@123"
}
```

Success `201`:

```json
{
  "success": true,
  "message": "Account created! Please verify your email.",
  "data": {
    "user": {
      "id": "...",
      "fullName": "John Doe",
      "userName": "john_doe",
      "email": "john@example.com",
      "profilePicture": "https://ui-avatars.com/..."
    },
    "message": "Verification email sent! Please check your inbox."
  }
}
```

Common errors:

- `400` validation errors
- `409` email/username already exists

### 3) Verify Email

- Method: `GET`
- Path: `/api/auth/verify-email/:token`
- Auth: Public

Success `200`:

```json
{
  "success": true,
  "message": "Email verified! Welcome to Synkro 🎉",
  "data": {
    "user": {
      "id": "...",
      "fullName": "John Doe",
      "userName": "john_doe",
      "email": "john@example.com",
      "profilePicture": "...",
      "status": "offline",
      "isVerified": true
    },
    "token": "jwt_access_token"
  }
}
```

### 4) Resend Verification Email

- Method: `POST`
- Path: `/api/auth/resend-verification`
- Auth: Public

Body:

```json
{
  "email": "john@example.com"
}
```

Success `200`:

```json
{
  "success": true,
  "message": "Verification email sent!",
  "data": null
}
```

### 5) Login

- Method: `POST`
- Path: `/api/auth/login`
- Auth: Public
- Rate limit: 10 requests / 15 minutes

Body:

```json
{
  "email": "john@example.com",
  "password": "Strong@123"
}
```

Success `200`:

```json
{
  "success": true,
  "message": "Login successful!",
  "data": {
    "user": {
      "id": "...",
      "fullName": "John Doe",
      "userName": "john_doe",
      "email": "john@example.com",
      "profilePicture": "...",
      "status": "offline",
      "isVerified": true
    },
    "token": "jwt_access_token"
  }
}
```

Also sets cookies: `synkroKey`, `refreshToken`.

### 6) Forgot Password

- Method: `POST`
- Path: `/api/auth/forgot-password`
- Auth: Public
- Rate limit: 3 requests / hour

Body:

```json
{
  "email": "john@example.com"
}
```

Success `200` (always generic to prevent email enumeration):

```json
{
  "success": true,
  "message": "If this email exists, a password reset link has been sent.",
  "data": null
}
```

### 7) Reset Password

- Method: `POST`
- Path: `/api/auth/reset-password`
- Auth: Public

Body:

```json
{
  "token": "reset_token_from_email",
  "newPassword": "NewStrong@123"
}
```

Success `200`:

```json
{
  "success": true,
  "message": "Password reset successful! Please login.",
  "data": null
}
```

### 8) Refresh Access Token

- Method: `POST`
- Path: `/api/auth/refresh-token`
- Auth: Public (requires `refreshToken` cookie)

Success `200`:

```json
{
  "success": true,
  "message": "Token refreshed",
  "data": {
    "token": "new_access_token"
  }
}
```

Also refreshes auth cookies via `generateToken(...)`.

### 9) Get Current User

- Method: `GET`
- Path: `/api/auth/me`
- Auth: Protected

Success `200`:

```json
{
  "success": true,
  "message": "User fetched successfully",
  "data": {
    "id": "...",
    "fullName": "John Doe",
    "userName": "john_doe",
    "email": "john@example.com",
    "profilePicture": "...",
    "status": "offline",
    "isVerified": true
  }
}
```

### 10) Update Profile

- Method: `PUT`
- Path: `/api/auth/profile`
- Auth: Protected

Body (send one or both):

```json
{
  "fullName": "John D.",
  "profilePicture": "https://example.com/avatar.jpg"
}
```

Success `200`: returns updated `user.profile`.

### 11) Logout

- Method: `POST`
- Path: `/api/auth/logout`
- Auth: Protected

Behavior:

- Clears `synkroKey` cookie
- Adds current token to blacklist
- Sets user status to offline

Success `200`:

```json
{
  "success": true,
  "message": "Logout successful",
  "data": null
}
```

### 12) Delete Account

- Method: `DELETE`
- Path: `/api/auth/account`
- Auth: Protected

Body:

```json
{
  "password": "CurrentPassword@123"
}
```

Success `200`:

```json
{
  "success": true,
  "message": "Account deleted successfully",
  "data": null
}
```

### 13) Get User By ID

- Method: `GET`
- Path: `/api/auth/users/:userId`
- Auth: Public

Returns user document excluding secret fields.

## Health and Root Endpoints

- `GET /` -> basic live status
- `GET /api/health` -> health check + uptime

## Notes

- Ensure `JWT_SECRET` and `JWT_REFRESH_SECRET` are strong and different values.
- For production, use HTTPS so secure cookies are transmitted correctly.
- If email is not configured, signup may still create account but returns an email warning.
