# Socket Examples

## Connect

Example client flow:

1. Connect with JWT token.
2. Join conversation room.
3. Send and listen for message events.

Pseudo example:

const socket = io("http://localhost:3000", {
auth: { token: "your-access-token" }
});

socket.emit("join:conversation", { conversationId: "convId" });

socket.emit("message:send", {
conversationId: "convId",
content: "Hello",
type: "text"
});

socket.on("message:new", (message) => {
console.log("New message", message);
});

socket.emit("typing:start", { conversationId: "convId" });
socket.emit("typing:stop", { conversationId: "convId" });

socket.on("typing:status", (payload) => {
console.log(payload.userName, payload.isTyping);
});
