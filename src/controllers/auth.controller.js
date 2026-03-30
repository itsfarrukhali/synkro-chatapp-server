import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
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
  sendWelcomeEmail,
  sendPasswordResetEmail,
  generateToken as generateVerificationToken,
} from "../services/email.service.js";

// Check Username
export const checkUsername = async (req, res) => {
  try {
    const { username } = req.params;
    if (!username)
      return ApiResponseUtil.badRequest(res, "Username is required");

    const usernameValidation = validateUsername(username);
    if (!usernameValidation.isValid)
      return ApiResponseUtil.badRequest(res, usernameValidation.message);

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

// Sign Up
export const signUp = async (req, res) => {
  try {
    const { fullName, userName, email, password } = req.body;

    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid)
      return ApiResponseUtil.badRequest(res, emailValidation.message);

    const usernameValidation = validateUsername(userName);
    if (!usernameValidation.isValid)
      return ApiResponseUtil.badRequest(res, usernameValidation.message);

    const fullNameValidation = validateFullName(fullName);
    if (!fullNameValidation.isValid)
      return ApiResponseUtil.badRequest(res, fullNameValidation.message);

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid)
      return ApiResponseUtil.badRequest(res, passwordValidation.message);

    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail)
      return ApiResponseUtil.conflict(res, "Email already registered");

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

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const verificationToken = generateVerificationToken();
    const verificationTokenExpiry = new Date();
    verificationTokenExpiry.setHours(verificationTokenExpiry.getHours() + 24);

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

    const emailResult = await sendVerificationEmail(
      newUser.email,
      newUser.fullName,
      verificationToken
    );

    const userData = {
      user: {
        id: newUser._id,
        fullName: newUser.fullName,
        userName: newUser.userName,
        email: newUser.email,
        profilePicture: newUser.profilePicture,
      },
    };

    if (!emailResult.success) {
      console.error("Failed to send verification email:", emailResult.error);
      return ApiResponseUtil.created(
        res,
        {
          ...userData,
          emailWarning:
            "Verification email could not be sent. Please contact support.",
        },
        "Account created! Email verification failed — contact support."
      );
    }

    return ApiResponseUtil.created(
      res,
      {
        ...userData,
        message: "Verification email sent! Please check your inbox.",
      },
      "Account created! Please verify your email."
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
    if (!token)
      return ApiResponseUtil.badRequest(res, "Verification token is required");

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

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpiry = undefined;
    await user.save();

    // Fire and forget — don't block response
    sendWelcomeEmail(user.email, user.fullName, user.userName).catch(
      console.error
    );

    const authToken = generateToken(user._id, res);

    return ApiResponseUtil.success(
      res,
      {
        user: user.profile,
        token: authToken,
      },
      "Email verified! Welcome to Synkro 🎉"
    );
  } catch (error) {
    console.error("Verification error:", error);
    return ApiResponseUtil.serverError(res, "Failed to verify email");
  }
};

// Resend Verification
export const resendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return ApiResponseUtil.badRequest(res, "Email is required");

    const user = await User.findOne({
      email: email.toLowerCase(),
      isVerified: false,
    });
    if (!user)
      return ApiResponseUtil.badRequest(
        res,
        "User not found or already verified"
      );

    const verificationToken = generateVerificationToken();
    const verificationTokenExpiry = new Date();
    verificationTokenExpiry.setHours(verificationTokenExpiry.getHours() + 24);

    user.verificationToken = verificationToken;
    user.verificationTokenExpiry = verificationTokenExpiry;
    await user.save();

    const emailResult = await sendVerificationEmail(
      user.email,
      user.fullName,
      verificationToken
    );
    if (!emailResult.success)
      return ApiResponseUtil.serverError(
        res,
        "Failed to send verification email"
      );

    return ApiResponseUtil.success(res, null, "Verification email sent!");
  } catch (error) {
    console.error("Resend verification error:", error);
    return ApiResponseUtil.serverError(
      res,
      "Failed to resend verification email"
    );
  }
};

// Login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return ApiResponseUtil.badRequest(res, "Email and password are required");

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password"
    );
    if (!user) return ApiResponseUtil.unauthorized(res, "Invalid credentials");

    if (!user.isVerified) {
      return ApiResponseUtil.unauthorized(
        res,
        "Please verify your email before logging in. Check your inbox for the verification link."
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid)
      return ApiResponseUtil.unauthorized(res, "Invalid credentials");

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

// Logout
export const logout = async (req, res) => {
  try {
    const token =
      req.cookies?.synkroKey || req.headers.authorization?.split(" ")[1];

    res.cookie("synkroKey", "", {
      httpOnly: true,
      expires: new Date(0),
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });

    if (token) {
      const { addToTokenBlacklist } = await import(
        "../utils/tokenBlacklist.js"
      );
      await addToTokenBlacklist(token);
    }

    // req.user is full Mongoose doc from protect middleware
    await User.findByIdAndUpdate(req.user._id, {
      status: "offline",
      socketId: null,
    });

    return ApiResponseUtil.success(res, null, "Logout successful");
  } catch (error) {
    console.error("Logout error:", error);
    return ApiResponseUtil.serverError(res, "Logout failed");
  }
};

// Get Current User
export const getCurrentUser = async (req, res) => {
  try {
    // req.user already attached by protect middleware (no extra DB call needed)
    return ApiResponseUtil.success(
      res,
      req.user.profile,
      "User fetched successfully"
    );
  } catch (error) {
    console.error("Get current user error:", error);
    return ApiResponseUtil.serverError(res, "Failed to get user");
  }
};

// Forgot Password
export const forgotPassword = async (req, res) => {
  // Always return same message to prevent email enumeration attack
  const genericMsg =
    "If this email exists, a password reset link has been sent.";
  try {
    const { email } = req.body;
    if (!email) return ApiResponseUtil.badRequest(res, "Email is required");

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return ApiResponseUtil.success(res, null, genericMsg);

    const resetToken = generateVerificationToken();
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1);

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpiry = resetTokenExpiry;
    await user.save();

    await sendPasswordResetEmail(user.email, user.fullName, resetToken);

    return ApiResponseUtil.success(res, null, genericMsg);
  } catch (error) {
    console.error("Forgot password error:", error);
    return ApiResponseUtil.success(res, null, genericMsg);
  }
};

// Reset Password
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword)
      return ApiResponseUtil.badRequest(
        res,
        "Token and new password are required"
      );

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid)
      return ApiResponseUtil.badRequest(res, passwordValidation.message);

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpiry: { $gt: new Date() },
    });

    if (!user)
      return ApiResponseUtil.badRequest(res, "Invalid or expired reset token");

    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiry = undefined;
    await user.save();

    return ApiResponseUtil.success(
      res,
      null,
      "Password reset successful! Please login."
    );
  } catch (error) {
    console.error("Reset password error:", error);
    return ApiResponseUtil.serverError(res, "Failed to reset password");
  }
};

// Update Profile
export const updateProfile = async (req, res) => {
  try {
    const { fullName, profilePicture } = req.body;
    const updateData = {};

    if (fullName) {
      const fullNameValidation = validateFullName(fullName);
      if (!fullNameValidation.isValid)
        return ApiResponseUtil.badRequest(res, fullNameValidation.message);
      updateData.fullName = fullName.trim();
    }

    if (profilePicture) updateData.profilePicture = profilePicture;

    const user = await User.findByIdAndUpdate(req.user._id, updateData, {
      new: true,
      runValidators: true,
    });

    return ApiResponseUtil.success(
      res,
      user.profile,
      "Profile updated successfully"
    );
  } catch (error) {
    console.error("Update profile error:", error);
    return ApiResponseUtil.serverError(res, "Failed to update profile");
  }
};

// Get User By ID
export const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select(
      "-password -verificationToken -resetPasswordToken"
    );
    if (!user) return ApiResponseUtil.notFound(res, "User not found");
    return ApiResponseUtil.success(res, user);
  } catch (error) {
    console.error("Get user by ID error:", error);
    return ApiResponseUtil.serverError(res, "Failed to get user");
  }
};

// Refresh Token
export const refreshToken = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token)
      return ApiResponseUtil.unauthorized(res, "No refresh token provided");

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const newToken = generateToken(decoded.userId, res); // sets cookie + returns token

    return ApiResponseUtil.success(res, { token: newToken }, "Token refreshed");
  } catch (error) {
    console.error("Refresh token error:", error);
    return ApiResponseUtil.unauthorized(
      res,
      "Invalid or expired refresh token"
    );
  }
};

// Delete Account
export const deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password)
      return ApiResponseUtil.badRequest(
        res,
        "Password is required to delete account"
      );

    const user = await User.findById(req.user._id).select("+password");
    if (!user) return ApiResponseUtil.notFound(res, "User not found");

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid)
      return ApiResponseUtil.unauthorized(res, "Incorrect password");

    await User.findByIdAndDelete(req.user._id);

    res.cookie("synkroKey", "", {
      expires: new Date(0),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });

    return ApiResponseUtil.success(res, null, "Account deleted successfully");
  } catch (error) {
    console.error("Delete account error:", error);
    return ApiResponseUtil.serverError(res, "Failed to delete account");
  }
};
