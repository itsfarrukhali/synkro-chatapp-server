# QA Mode: Postman Run Order and Checklist

This runbook defines how to run regression checks using the current Postman collections.

## Collections

- Auth collection: src/test/userApi.postman.json
- Conversations and messages collection: src/test/messageApi.postman.json

## Preconditions

- Backend running at http://localhost:3000
- MongoDB connected
- At least two test users available
- Access token for user A and user B ready

## Recommended Run Order

1. Import both collections in Postman.
2. Run auth collection first: src/test/userApi.postman.json
3. Capture token and IDs from successful auth flow.
4. Set these variables in message collection:
   - authToken
   - authTokenB
   - userBId
5. Run message collection folder sequence:
   - Conversations
   - Messages
   - Search
   - Group Management

## Critical Happy Path Checklist

- Signup creates user and returns 201.
- Verify-email returns token and verified profile.
- Login returns token and cookies.
- Refresh-token returns new access token.
- Create DM returns single reusable conversation.
- Send message returns 201 and message ID.
- Edit own message returns isEdited true.
- Toggle reaction adds and removes emoji.
- Mark seen returns 200.
- Delete message returns messageId.

## Authorization Checklist

- Protected auth route without token returns 401.
- Non-participant cannot send message to conversation (403).
- Non-owner cannot edit another user's message (not found behavior in current controller).
- Non-admin cannot update group settings (403).

## Validation and Rate Limit Checklist

- Invalid username format returns 400.
- Weak password on signup or reset returns 400.
- Empty text message returns 400.
- Missing search query returns 400.
- Signup rate limit triggers 429 after threshold.
- Login rate limit triggers 429 after threshold.

## Regression Exit Criteria

- No 5xx on happy-path suite.
- All critical happy-path checks pass.
- Authorization checks return expected failure codes.
- No endpoint contract mismatch against docs/api/\*.md.
