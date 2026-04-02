# Setup Guide

Use this guide to run the backend locally.

## Prerequisites

- Node.js 18+
- MongoDB 6+ (local or cloud)

## 1. Install Dependencies

npm install

## 2. Configure Environment

Create .env in backend root with at least:

PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/synkro
JWT_SECRET=replace_with_strong_secret
JWT_REFRESH_SECRET=replace_with_another_strong_secret
FRONTEND_URL=http://localhost:5173

Optional email variables:

- Gmail: GMAIL_USER, GMAIL_APP_PASSWORD
- Ethereal: USE_ETHEREAL=true, ETHEREAL_EMAIL, ETHEREAL_PASSWORD
- SMTP: SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS

## 3. Run

- Development: npm run dev
- Production: npm start

## 4. Verify

- Live route: GET /
- Health route: GET /api/health

## 5. Read Next

- Docs index: ./README.md
- Architecture: ./architecture.md
