# Socket Events: Client to Server

Connection URL: http://localhost:3000

Authentication:

- Send access token in socket auth token or Authorization Bearer header.

## Room Management

### join:conversation

Payload:

{
"conversationId": "conversationObjectId"
}

### leave:conversation

Payload:

{
"conversationId": "conversationObjectId"
}

## Messaging

### message:send

Payload:

{
"conversationId": "conversationObjectId",
"content": "Hello world",
"type": "text",
"replyTo": "optionalMessageId",
"mediaUrl": "optional",
"mediaMeta": {}
}

### message:edit

Payload:

{
"messageId": "messageObjectId",
"content": "Updated text"
}

### message:delete

Payload:

{
"messageId": "messageObjectId"
}

### message:seen

Payload:

{
"conversationId": "conversationObjectId"
}

### reaction:toggle

Payload:

{
"messageId": "messageObjectId",
"emoji": "🔥"
}

## Typing

### typing:start

Payload:

{
"conversationId": "conversationObjectId"
}

### typing:stop

Payload:

{
"conversationId": "conversationObjectId"
}
