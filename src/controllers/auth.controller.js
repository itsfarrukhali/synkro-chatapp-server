import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import { generateToken } from "../utils/generateToken.js";
import ApiResponseUtil from "../utils/apiResponse.js";
import {
  validateEmail,
  validateUsername,
  validateFullName,
  validatePassword,
  checkUsernameAvailability,
} from "../utils/validators.js";
import {
  sendVerificationEmail,
  generateToken as generateVerificationToken,
} from "../services/email.service.js";

// Check username availability API endpoint
export const checkUsername = async (req, res) => {
  try {
    const { username } = req.params;

    if (!username) {
      return ApiResponseUtil.badRequest(res, "Username is required");
    }

    const usernameValidation = validateUsername(username);
    if (!usernameValidation.isValid) {
      return ApiResponseUtil.badRequest(res, usernameValidation.message);
    }

    const availability = await checkUsernameAvailability(username, User);

    return ApiResponseUtil.success(res, {
      isAvailable: availability.isAvailable,
      suggestions: availability.suggestions,
      message: availability.isAvailable
        ? "Username is available"
        : "Username is taken",
    });
  } catch (error) {
    console.error("Username check error:", error);
    return ApiResponseUtil.serverError(
      res,
      "Failed to check username availability"
    );
  }
};

// Signup with email verification
export const signUp = async (req, res) => {
  try {
    const { fullName, userName, email, password } = req.body;

    // 1. Validate all fields
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      return ApiResponseUtil.badRequest(res, emailValidation.message);
    }

    const usernameValidation = validateUsername(userName);
    if (!usernameValidation.isValid) {
      return ApiResponseUtil.badRequest(res, usernameValidation.message);
    }

    const fullNameValidation = validateFullName(fullName);
    if (!fullNameValidation.isValid) {
      return ApiResponseUtil.badRequest(res, fullNameValidation.message);
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return ApiResponseUtil.badRequest(res, passwordValidation.message);
    }

    // 2. Check if email already exists
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return ApiResponseUtil.conflict(res, "Email already registered");
    }

    // 3. Check username availability
    const usernameAvailability = await checkUsernameAvailability(
      userName,
      User
    );
    if (!usernameAvailability.isAvailable) {
      return ApiResponseUtil.conflict(res, {
        message: "Username already taken",
        suggestions: usernameAvailability.suggestions,
      });
    }

    // 4. Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 5. Generate verification token
    const verificationToken = generateVerificationToken();
    const verificationTokenExpiry = new Date();
    verificationTokenExpiry.setHours(verificationTokenExpiry.getHours() + 24); // 24 hours expiry

    // 6. Create user (unverified)
    const newUser = new User({
      fullName: fullName.trim(),
      userName: userName.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      profilePicture: `https://ui-avatars.com/api/?background=667eea&color=fff&bold=true&name=${encodeURIComponent(
        fullName
      )}&size=128`,
      isVerified: false,
      verificationToken,
      verificationTokenExpiry,
    });

    await newUser.save();

    // 7. Send verification email
    const emailResult = await sendVerificationEmail(
      newUser.email,
      newUser.fullName,
      verificationToken
    );

    if (!emailResult.success) {
      console.error("Failed to send verification email:", emailResult.error);
      // Still return success but warn user
      return ApiResponseUtil.created(
        res,
        {
          user: {
            id: newUser._id,
            fullName: newUser.fullName,
            userName: newUser.userName,
            email: newUser.email,
            profilePicture: newUser.profilePicture,
          },
          message:
            "Account created! Please check your email to verify your account.",
          emailWarning:
            "Verification email could not be sent. Please contact support.",
        },
        "Account created successfully! Please verify your email."
      );
    }

    // 8. Return response (don't send token until verified)
    return ApiResponseUtil.created(
      res,
      {
        user: {
          id: newUser._id,
          fullName: newUser.fullName,
          userName: newUser.userName,
          email: newUser.email,
          profilePicture: newUser.profilePicture,
        },
        message: "Verification email sent! Please check your inbox.",
      },
      "Account created! Please verify your email to start chatting."
    );
  } catch (error) {
    console.error("Signup error:", error);

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return ApiResponseUtil.conflict(
        res,
        `${field === "email" ? "Email" : "Username"} already exists`
      );
    }

    return ApiResponseUtil.serverError(res, "Unable to create account");
  }
};

// Verify Email
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return ApiResponseUtil.badRequest(res, "Verification token is required");
    }

    // Find user with this token and not expired
    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpiry: { $gt: new Date() },
      isVerified: false,
    });

    if (!user) {
      return ApiResponseUtil.badRequest(
        res,
        "Invalid or expired verification token. Please request a new verification email."
      );
    }

    // Update user as verified
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpiry = undefined;
    await user.save();

    // Send welcome email after verification
    const { sendWelcomeEmail } = await import("../services/email.service.js");
    sendWelcomeEmail(user.email, user.fullName, user.userName).catch(
      console.error
    );

    // Generate token for auto-login
    const authToken = generateToken(user._id, res);

    return ApiResponseUtil.success(
      res,
      {
        user: user.profile,
        token: authToken,
        message: "Email verified successfully! You can now start chatting.",
      },
      "Email verified! Welcome to Synkro 🎉"
    );
  } catch (error) {
    console.error("Verification error:", error);
    return ApiResponseUtil.serverError(res, "Failed to verify email");
  }
};

// Resend Verification Email
export const resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return ApiResponseUtil.badRequest(res, "Email is required");
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
      isVerified: false,
    });

    if (!user) {
      return ApiResponseUtil.badRequest(
        res,
        "User not found or already verified"
      );
    }

    // Generate new verification token
    const { generateToken } = await import("../services/email.service.js");
    const verificationToken = generateToken();
    const verificationTokenExpiry = new Date();
    verificationTokenExpiry.setHours(verificationTokenExpiry.getHours() + 24);

    user.verificationToken = verificationToken;
    user.verificationTokenExpiry = verificationTokenExpiry;
    await user.save();

    // Send new verification email
    const { sendVerificationEmail } = await import(
      "../services/email.service.js"
    );
    const emailResult = await sendVerificationEmail(
      user.email,
      user.fullName,
      verificationToken
    );

    if (!emailResult.success) {
      return ApiResponseUtil.serverError(
        res,
        "Failed to send verification email"
      );
    }

    return ApiResponseUtil.success(
      res,
      {
        message: "Verification email resent. Please check your inbox.",
      },
      "Verification email sent!"
    );
  } catch (error) {
    console.error("Resend verification error:", error);
    return ApiResponseUtil.serverError(
      res,
      "Failed to resend verification email"
    );
  }
};

// Login (only allow verified users)
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return ApiResponseUtil.badRequest(res, "Email and password are required");
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password"
    );

    if (!user) {
      return ApiResponseUtil.unauthorized(res, "Invalid credentials");
    }

    // Check if email is verified
    if (!user.isVerified) {
      return ApiResponseUtil.unauthorized(
        res,
        "Please verify your email before logging in. Check your inbox for the verification link."
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return ApiResponseUtil.unauthorized(res, "Invalid credentials");
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id, res);

    return ApiResponseUtil.success(
      res,
      {
        user: user.profile,
        token,
      },
      "Login successful!"
    );
  } catch (error) {
    console.error("Login error:", error);
    return ApiResponseUtil.serverError(res, "Login failed");
  }
};
