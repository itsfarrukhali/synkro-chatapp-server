# Synkro Backend API

Real-time messaging backend built with Express, MongoDB, and Socket.io.

## Quick Start

1. Install dependencies: npm install
2. Configure environment: copy .env.example to .env and fill values
3. Start in dev mode: npm run dev

Server default URL: http://localhost:3000

## Tech Stack

- Runtime: Node.js 18+
- Framework: Express.js
- Database: MongoDB with Mongoose
- Realtime: Socket.io
- Auth: JWT + cookies

## Documentation Index

Primary docs entrypoint: ./docs/README.md

- Setup and environment: ./docs/setup.md
- Architecture: ./docs/architecture.md
- API docs index: ./docs/api/
- Socket docs index: ./docs/sockets/
- Examples: ./docs/examples/
- QA runbook: ./docs/qa/postman-run-order-checklist.md
- Error handling: ./docs/errors.md

## Base URLs

- REST API: http://localhost:3000/api
- Socket.io: ws://localhost:3000
