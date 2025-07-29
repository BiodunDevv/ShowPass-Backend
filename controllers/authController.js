const User = require("../models/User");
const {
  generateToken,
  generateVerificationToken,
  sanitizeUser,
  sendSuccess,
  sendError,
} = require("../utils/helpers");
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
} = require("../utils/emailService");
const crypto = require("crypto");

// Register new user
const register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, role = "user" } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return sendError(res, 400, "User with this email already exists");
    }

    // Generate verification token
    const verificationToken = generateVerificationToken();

    // Create user
    const user = new User({
      firstName,
      lastName,
      email,
      password,
      role,
      verificationToken,
    });

    await user.save();

    // Send verification email
    try {
      await sendVerificationEmail(user, verificationToken);
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
      // Don't fail registration if email fails
    }

    // Generate token
    const token = generateToken(user._id);

    sendSuccess(
      res,
      "Registration successful! Please check your email to verify your account.",
      {
        user: sanitizeUser(user),
        token,
      }
    );
  } catch (error) {
    console.error("Registration error:", error);
    sendError(res, 500, "Registration failed", error.message);
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return sendError(res, 401, "Invalid email or password");
    }

    // Check if user is blocked
    if (user.blocked) {
      return sendError(
        res,
        403,
        "Your account has been blocked. Please contact support."
      );
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return sendError(res, 401, "Invalid email or password");
    }

    // Generate token
    const token = generateToken(user._id);

    sendSuccess(res, "Login successful", {
      user: sanitizeUser(user),
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    sendError(res, 500, "Login failed", error.message);
  }
};

// Get current user
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    sendSuccess(res, "User profile retrieved successfully", sanitizeUser(user));
  } catch (error) {
    console.error("Get profile error:", error);
    sendError(res, 500, "Failed to retrieve user profile", error.message);
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone, dateOfBirth, address } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return sendError(res, 404, "User not found");
    }

    // Update allowed fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;
    if (dateOfBirth) user.dateOfBirth = dateOfBirth;
    if (address) user.address = address;

    await user.save();

    sendSuccess(res, "Profile updated successfully", sanitizeUser(user));
  } catch (error) {
    console.error("Profile update error:", error);
    sendError(res, 500, "Failed to update profile", error.message);
  }
};

// Verify email
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return sendError(res, 400, "Verification token is required");
    }

    const user = await User.findOne({ verificationToken: token });
    if (!user) {
      return sendError(res, 400, "Invalid or expired verification token");
    }

    // Update user
    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();

    sendSuccess(
      res,
      "Email verified successfully! You can now access all features."
    );
  } catch (error) {
    console.error("Email verification error:", error);
    sendError(res, 500, "Email verification failed", error.message);
  }
};

// Resend verification email
const resendVerification = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return sendError(res, 404, "User not found");
    }

    if (user.isVerified) {
      return sendError(res, 400, "Email is already verified");
    }

    // Generate new verification token
    const verificationToken = generateVerificationToken();
    user.verificationToken = verificationToken;
    await user.save();

    // Send verification email
    await sendVerificationEmail(user, verificationToken);

    sendSuccess(res, "Verification email sent successfully");
  } catch (error) {
    console.error("Resend verification error:", error);
    sendError(res, 500, "Failed to resend verification email", error.message);
  }
};

// Forgot password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return sendError(res, 404, "No user found with this email address");
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    user.resetPasswordExpire = Date.now() + 60 * 60 * 1000; // 1 hour

    await user.save();

    // Send reset email
    try {
      await sendPasswordResetEmail(user, resetToken);
      sendSuccess(res, "Password reset email sent successfully");
    } catch (emailError) {
      console.error("Reset email failed:", emailError);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();

      sendError(res, 500, "Failed to send password reset email");
    }
  } catch (error) {
    console.error("Forgot password error:", error);
    sendError(
      res,
      500,
      "Failed to process password reset request",
      error.message
    );
  }
};

// Reset password
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return sendError(res, 400, "Token and new password are required");
    }

    // Hash token to compare with database
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return sendError(res, 400, "Invalid or expired reset token");
    }

    // Update password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // Generate new token
    const authToken = generateToken(user._id);

    sendSuccess(res, "Password reset successful", {
      user: sanitizeUser(user),
      token: authToken,
    });
  } catch (error) {
    console.error("Reset password error:", error);
    sendError(res, 500, "Failed to reset password", error.message);
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return sendError(
        res,
        400,
        "Current password and new password are required"
      );
    }

    const user = await User.findById(req.user._id);

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      return sendError(res, 400, "Current password is incorrect");
    }

    // Update password
    user.password = newPassword;
    await user.save();

    sendSuccess(res, "Password changed successfully");
  } catch (error) {
    console.error("Change password error:", error);
    sendError(res, 500, "Failed to change password", error.message);
  }
};

// Logout (client-side token removal)
const logout = async (req, res) => {
  sendSuccess(res, "Logged out successfully");
};

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  changePassword,
  logout,
};
