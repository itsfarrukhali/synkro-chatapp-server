import nodemailer from "nodemailer";

// Create transporter based on environment
const createTransporter = () => {
  console.log("🔧 Creating email transporter...");
  console.log(
    "GMAIL_USER:",
    process.env.GMAIL_USER ? "✓ Present" : "✗ Missing"
  );
  console.log(
    "GMAIL_APP_PASSWORD:",
    process.env.GMAIL_APP_PASSWORD ? "✓ Present" : "✗ Missing"
  );

  // FIRST: Check if Gmail is configured (most common)
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    console.log("Configuring Gmail email service");
    console.log(`Account: ${process.env.GMAIL_USER}`);
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    return transporter;
  }

  // SECOND: Check if Ethereal is enabled
  if (process.env.USE_ETHEREAL === "true" && process.env.ETHEREAL_EMAIL) {
    console.log("Configuring Ethereal email service");

    const transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: process.env.ETHEREAL_EMAIL,
        pass: process.env.ETHEREAL_PASSWORD,
      },
    });

    return transporter;
  }

  // THIRD: Check custom SMTP
  if (process.env.SMTP_HOST) {
    console.log("Configuring custom SMTP service");

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    return transporter;
  }

  // No configuration found
  console.error("❌ No email configuration found in .env");
  console.error("   Please set either:");
  console.error("   - GMAIL_USER + GMAIL_APP_PASSWORD");
  console.error("   - USE_ETHEREAL=true + ETHEREAL_EMAIL + ETHEREAL_PASSWORD");
  console.error("   - SMTP_HOST + SMTP_USER + SMTP_PASS");
  return null;
};

// Create transporter instance
let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  transporter = createTransporter();

  if (transporter) {
    transporter.verify((error, _success) => {
      if (error) {
        console.error(
          "❌ Email transporter verification failed:",
          error.message
        );
        transporter = null;
      } else {
        console.log("✅ Email transporter ready");
      }
    });
  }

  return transporter;
};

// Generate random token
export const generateToken = () => {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
};

// Send verification email
export const sendVerificationEmail = async (
  email,
  fullName,
  verificationToken
) => {
  const transporter = getTransporter();
  // Check if transporter is available
  if (!transporter) {
    console.error("❌ Cannot send email: No email transporter configured");
    return {
      success: false,
      error: "Email service not configured. Please contact support.",
    };
  }

  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .header h1 { color: white; margin: 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; padding: 14px 32px; background: #667eea; color: white; text-decoration: none; border-radius: 50px; margin: 20px 0; font-weight: bold; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✨ Welcome to Synkro!</h1>
        </div>
        <div class="content">
          <h2>Hello ${fullName}! 👋</h2>
          <p>Thank you for signing up for Synkro. We're excited to have you on board!</p>
          <p>Please verify your email address to start chatting with your friends.</p>
          <center>
            <a href="${verificationUrl}" class="button">Verify Email Address →</a>
          </center>
          <div class="warning">
            <p>⚠️ <strong>This link will expire in 24 hours.</strong></p>
            <p>If you didn't create an account with Synkro, you can safely ignore this email.</p>
          </div>
          <p>Or copy and paste this link into your browser:</p>
          <p style="background: #e9ecef; padding: 10px; border-radius: 5px; word-break: break-all;">
            ${verificationUrl}
          </p>
          <hr style="margin: 30px 0;">
          <p style="font-size: 14px;">Need help? Contact us at support@synkro.app</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Synkro. All rights reserved.</p>
          <p>Connect with friends, share moments, and enjoy real-time chat!</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const info = await transporter.sendMail({
      from:
        process.env.EMAIL_FROM ||
        `"Synkro" <${process.env.GMAIL_USER || "noreply@synkro.app"}>`,
      to: email,
      subject: "Verify Your Email - Synkro",
      html: emailHtml,
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Email sending error:", error.message);
    return { success: false, error: error.message };
  }
};

// Send welcome email after verification
export const sendWelcomeEmail = async (email, fullName, userName) => {
  const transporter = getTransporter();
  if (!transporter) {
    console.error(
      "❌ Cannot send welcome email: No email transporter configured"
    );
    return { success: false };
  }

  const loginUrl = `${process.env.FRONTEND_URL}/login`;

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Email Verified!</h1>
        </div>
        <div class="content">
          <h2>Welcome to Synkro, ${fullName}! 🎊</h2>
          <p>Your email has been successfully verified. Your username <strong>@${userName}</strong> is ready!</p>
          <p>Here's what you can do:</p>
          <ul>
            <li>💬 Chat in real-time with friends</li>
            <li>📸 Share images and files</li>
            <li>👥 Create group conversations</li>
            <li>🔔 Get instant notifications</li>
          </ul>
          <center>
            <a href="${loginUrl}" class="button">Start Chatting →</a>
          </center>
          <p>Happy chatting!<br>The Synkro Team</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from:
        process.env.EMAIL_FROM ||
        `"Synkro" <${process.env.GMAIL_USER || "noreply@synkro.app"}>`,
      to: email,
      subject: "Welcome to Synkro! 🎉",
      html: emailHtml,
    });
    return { success: true };
  } catch (error) {
    console.error("❌ Welcome email error:", error.message);
    return { success: false };
  }
};

// Send password reset email
export const sendPasswordResetEmail = async (email, fullName, resetToken) => {
  const transporter = getTransporter();
  if (!transporter) {
    console.error(
      "❌ Cannot send password reset email: No email transporter configured"
    );
    return { success: false };
  }

  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #ff6b6b; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .button { display: inline-block; padding: 12px 24px; background: #ff6b6b; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Password Reset Request</h1>
        </div>
        <div class="content">
          <h2>Hello ${fullName},</h2>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <center>
            <a href="${resetUrl}" class="button">Reset Password →</a>
          </center>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this, please ignore this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from:
        process.env.EMAIL_FROM ||
        `"Synkro" <${process.env.GMAIL_USER || "noreply@synkro.app"}>`,
      to: email,
      subject: "Password Reset Request - Synkro",
      html: emailHtml,
    });
    return { success: true };
  } catch (error) {
    console.error("❌ Password reset email error:", error.message);
    return { success: false };
  }
};
