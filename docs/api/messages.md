# Messages API Contract

Base path: /api/conversations

Auth: All endpoints are protected.

## GET /search/messages

Query params:

- q: required text query
- conversationId: optional conversation scope

Success response shape:

```json
{
  "success": true,
  "message": "Search results",
  "data": [
    {
      "_id": "messageId",
      "content": "matched text",
      "sender": {},
      "conversationId": {}
    }
  ]
}
```

Status matrix: 200 success, 400 missing query, 401 unauthorized, 403 no conversation access, 500 server error

## GET /:conversationId/messages

Query params:

- cursor: optional ISO datetime for cursor-based pagination
- limit: optional, default 30

Success response example:

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "messages": [],
    "hasMore": false,
    "nextCursor": null
  }
}
```

Status matrix: 200 success, 401 unauthorized, 403 access denied, 500 server error

## POST /:conversationId/messages

Request example:

```json
{
  "content": "Hello",
  "type": "text",
  "replyTo": "optionalMessageId",
  "mediaUrl": "optional",
  "mediaMeta": {}
}
```

Success response shape:

```json
{
  "success": true,
  "message": "Message sent",
  "data": {
    "_id": "messageId",
    "conversationId": "conversationId",
    "sender": {},
    "content": "Hello",
    "type": "text",
    "replyPreview": null
  }
}
```

Status matrix: 201 created, 400 validation error, 401 unauthorized, 403 not a participant, 500 server error

## PUT /messages/:messageId

Request example:

```json
{
  "content": "Updated content"
}
```

Success response shape:

```json
{
  "success": true,
  "message": "Message edited",
  "data": {
    "_id": "messageId",
    "content": "Updated content",
    "isEdited": true,
    "editedAt": "2026-04-03T10:00:00.000Z"
  }
}
```

Status matrix: 200 success, 400 invalid content, 401 unauthorized, 404 not found or not editable, 500 server error

## DELETE /messages/:messageId

Soft delete for sender-owned message.

Success response example:

```json
{
  "success": true,
  "message": "Message deleted",
  "data": {
    "messageId": "messageId"
  }
}
```

Status matrix: 200 success, 401 unauthorized, 404 message not found, 500 server error

## POST /messages/:messageId/reactions

Request example:

```json
{
  "emoji": "👍"
}
```

Success response shape:

```json
{
  "success": true,
  "message": "Reaction updated",
  "data": {
    "messageId": "messageId",
    "reactions": [
      {
        "emoji": "👍",
        "users": ["userId"]
      }
    ]
  }
}
```

Status matrix: 200 success, 400 missing emoji, 401 unauthorized, 404 message not found, 500 server error

## POST /:conversationId/seen

Marks all unseen incoming messages as seen for current user.

Success response example:

```json
{
  "success": true,
  "message": "Marked as seen",
  "data": null
}
```

Status matrix: 200 success, 401 unauthorized, 403 access denied, 500 server error
