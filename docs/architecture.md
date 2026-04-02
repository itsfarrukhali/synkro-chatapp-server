# Architecture

## Overview

Synkro backend exposes REST APIs for account and conversation management, and Socket.io for low-latency chat events.

## High-Level Components

- Server bootstrap: src/server.js
- REST controllers: src/controllers/
- Route modules: src/routes/
- Data models: src/models/
- Auth middleware: src/middleware/auth.middleware.js
- Realtime handlers: src/socket/sockets.handler.js
- Shared response helpers: src/utils/apiResponse.js

## Request Flow

1. Client calls REST endpoint under /api/auth or /api/conversations.
2. Protected routes pass through auth middleware and attach req.user.
3. Controller validates input, executes model operations, and returns standard response shape.

## Realtime Flow

1. Client connects to Socket.io with JWT token in auth token or Authorization header.
2. Socket middleware verifies token and loads user.
3. Client joins conversation room before live events.
4. Message and typing events are broadcast to room participants.

## Data Layer

- MongoDB stores users, conversations, and messages.
- Conversation model tracks last message and unread counts.
- Message model stores content, media metadata, reactions, delivery and seen metadata.

## Security Notes

- JWT required for protected REST and socket connections.
- Token blacklist blocks invalidated tokens.
- Rate limits are enabled for signup, login, and forgot-password flows.
