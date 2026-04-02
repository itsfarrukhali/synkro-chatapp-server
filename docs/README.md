# Synkro Backend Documentation

This folder is organized for fast navigation. Each document has a single purpose so new developers can find answers in under 30 seconds.

## Start Here

- Setup: ./setup.md
- Architecture: ./architecture.md
- Error handling: ./errors.md

## REST API

- Auth endpoints: ./api/auth.md
- User-focused endpoints: ./api/users.md
- Conversation endpoints: ./api/conversations.md
- Message endpoints: ./api/messages.md

Each API file includes compact request and response examples plus status code matrix.

## QA

- Postman run order and checklist: ./qa/postman-run-order-checklist.md

## Socket.io

- Client to server events: ./sockets/client-to-server.md
- Server to client events: ./sockets/server-to-client.md

## Examples

- REST examples: ./examples/rest.md
- Socket examples: ./examples/socket.md

## Docs Rules

- Keep request and response examples short and real.
- Prefer one endpoint per section with method + path at top.
- Update docs in the same pull request as behavior changes.
