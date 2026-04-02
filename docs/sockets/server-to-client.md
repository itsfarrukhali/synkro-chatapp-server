# Socket Events: Server to Client

This file documents events emitted by the backend socket handler.

## Presence

### users:online

Sent on connect with list of online user IDs.

Payload:

["userId1", "userId2"]

### user:online

Broadcast when users go online or offline.

Payload:

{
"userId": "userObjectId",
"status": "online|offline",
"lastSeen": "optionalDate"
}

## Conversation and Message Streams

### messages:pending

Sent after joining a conversation when unseen messages exist.

### message:new

Broadcast to conversation room when a new message is created.

### message:updated

Broadcast when a message is edited or soft deleted.

### reaction:updated

Broadcast reaction changes for a message.

### message:seen

Sent to original sender when recipient marks messages as seen.

### conversation:updated

Broadcast conversation-level metadata updates like last message and unread counts.

## Typing

### typing:status

Broadcast typing state to room participants.

Payload:

{
"userId": "userObjectId",
"userName": "Sender Name",
"isTyping": true,
"conversationId": "conversationObjectId"
}

## Error

### error

Emitted for operational failures.

Payload:

{
"message": "Error description"
}
