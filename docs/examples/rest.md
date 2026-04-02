# REST Examples

Base URL: http://localhost:3000/api

## Sign Up

POST /auth/signup

{
"fullName": "John Doe",
"userName": "john_doe",
"email": "john@example.com",
"password": "Strong@123"
}

## Login

POST /auth/login

{
"email": "john@example.com",
"password": "Strong@123"
}

## Create DM

POST /conversations/dm

{
"participantId": "otherUserId"
}

## Send Message

POST /conversations/:conversationId/messages

{
"content": "Hello from REST",
"type": "text"
}

## Mark Seen

POST /conversations/:conversationId/seen

{}
