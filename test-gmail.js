import { config } from "dotenv";
config();

const { sendVerificationEmail } = await import(
  "./src/services/email.service.js"
);

async function testGmail() {
  console.log("Testing Gmail configuration...");
  console.log("GMAIL_USER:", process.env.GMAIL_USER);
  console.log(
    "GMAIL_APP_PASSWORD:",
    process.env.GMAIL_APP_PASSWORD ? "✓ Set" : "✗ Not set"
  );

  const result = await sendVerificationEmail(
    process.env.GMAIL_USER, // Send to yourself for testing
    "Test User",
    "test-token-123"
  );

  if (result.success) {
    console.log("✅ Email sent successfully!");
  } else {
    console.error("❌ Email failed:", result.error);
  }
}

testGmail();
