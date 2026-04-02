# Conversations API Contract

Base path: /api/conversations

Auth: All endpoints are protected.

## GET /

Returns the current user's conversation list.

Success response shape:

```json
{
  "success": true,
  "message": "Conversations fetched",
  "data": [
    {
      "_id": "conversationId",
      "isGroup": false,
      "participants": [],
      "lastMessage": {},
      "unreadCount": 0
    }
  ]
}
```

Status matrix: 200 success, 401 unauthorized, 500 server error

## POST /dm

Request example:

```json
{
  "targetUserId": "userObjectId"
}
```

Success response shape:

```json
{
  "success": true,
  "message": "Conversation ready",
  "data": {
    "_id": "conversationId",
    "isGroup": false,
    "participants": []
  }
}
```

Status matrix: 200 success, 400 invalid input, 404 target user not found, 401 unauthorized, 500 server error

## POST /group

Request example:

```json
{
  "groupName": "Project Team",
  "participantIds": ["user1", "user2"]
}
```

Success response shape:

```json
{
  "success": true,
  "message": "Group created",
  "data": {
    "_id": "conversationId",
    "isGroup": true,
    "groupName": "Project Team",
    "participants": []
  }
}
```

Status matrix: 201 created, 400 validation error, 401 unauthorized, 500 server error

## GET /:conversationId

Returns a single conversation with populated participants.

Success response shape:

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "_id": "conversationId",
    "isGroup": true,
    "groupName": "Project Team",
    "participants": [],
    "lastMessage": {}
  }
}
```

Status matrix: 200 success, 401 unauthorized, 404 not found, 500 server error

## PUT /:conversationId/group

Request example:

```json
{
  "groupName": "Updated Team",
  "groupAvatar": "https://example.com/group.png"
}
```

Success response shape:

```json
{
  "success": true,
  "message": "Group updated",
  "data": {
    "_id": "conversationId",
    "groupName": "Updated Team",
    "groupAvatar": "https://example.com/group.png",
    "participants": []
  }
}
```

Status matrix: 200 success, 401 unauthorized, 403 only admin allowed, 404 group not found, 500 server error

## POST /:conversationId/participants

Request example:

```json
{
  "userIds": ["user3", "user4"]
}
```

Success response shape:

```json
{
  "success": true,
  "message": "Participants added",
  "data": {
    "_id": "conversationId",
    "participants": []
  }
}
```

Status matrix: 200 success, 401 unauthorized, 404 group not found or requester not admin, 500 server error

## DELETE /:conversationId/leave

Removes current user from group conversation.

Success response example:

```json
{
  "success": true,
  "message": "Left group successfully",
  "data": null
}
```

Status matrix: 200 success, 401 unauthorized, 404 group not found, 500 server error

## POST /:conversationId/mute

Toggles mute for current user.

Success response shape:

```json
{
  "success": true,
  "message": "Conversation muted",
  "data": {
    "muted": true
  }
}
```

Status matrix: 200 success, 401 unauthorized, 404 conversation not found, 500 server error
