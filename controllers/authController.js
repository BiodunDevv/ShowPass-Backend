const UserManager = require("../utils/UserManager");
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
  sendWelcomeEmail,
} = require("../utils/emailService");
const { randomBytes, createHash } = require("crypto");

// Register new user
const register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, role = "user" } = req.body;

    // Check if user already exists across all collections
    const existingUserResult = await UserManager.findByEmail(email);
    if (existingUserResult) {
      return sendError(res, 400, "User with this email already exists");
    }

    // Generate 6-digit verification code
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();
    const verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Create user in appropriate collection
    const { user } = await UserManager.createUser({
      firstName,
      lastName,
      email,
      password,
      role,
      verificationCode,
      verificationCodeExpires,
    });

    // Send verification email
    try {
      await sendVerificationEmail(user, verificationCode);
      console.log(`🔐 Verification code for ${email}: ${verificationCode}`);
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

    // Find user across all collections
    const userResult = await UserManager.findByEmail(email);
    if (!userResult) {
      return sendError(res, 401, "Invalid email or password");
    }

    const { user } = userResult;

    // Check if user is blocked
    if (user.blocked) {
      return sendError(
        res,
        403,
        "Your account has been blocked. Please contact support."
      );
    }

    // Check if user is verified
    if (!user.isVerified) {
      return sendError(
        res,
        403,
        "Please verify your email address before logging in. Check your email for verification instructions."
      );
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return sendError(res, 401, "Invalid email or password");
    }

    // Update last login for admins
    if (user.role === "admin") {
      user.lastLogin = new Date();
      await user.save();
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
    const userResult = await UserManager.findById(req.user._id);
    if (!userResult) {
      return sendError(res, 404, "User not found");
    }

    const { user } = userResult;
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

    const userResult = await UserManager.findById(req.user._id);
    if (!userResult) {
      return sendError(res, 404, "User not found");
    }

    const { user, model } = userResult;

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

// Verify email with 6-digit code
const verifyEmail = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return sendError(res, 400, "Verification code is required");
    }

    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(code)) {
      return sendError(res, 400, "Verification code must be 6 digits");
    }

    const userResult = await UserManager.findByVerificationCode(code);
    if (!userResult) {
      return sendError(res, 400, "Invalid or expired verification code");
    }

    const { user } = userResult;

    // Check if code has expired (15 minutes)
    if (
      user.verificationCodeExpires &&
      user.verificationCodeExpires < new Date()
    ) {
      return sendError(
        res,
        400,
        "Verification code has expired. Please request a new one."
      );
    }

    // Update user
    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();

    // Send welcome email after successful verification
    try {
      await sendWelcomeEmail(user);
      console.log(`🎉 Welcome email sent to ${user.email}`);
    } catch (emailError) {
      console.error("Welcome email failed:", emailError);
      // Don't fail verification if welcome email fails
    }

    sendSuccess(
      res,
      "Email verified successfully! Welcome to ShowPass! 🎉 You can now access all features."
    );
  } catch (error) {
    console.error("Email verification error:", error);
    sendError(res, 500, "Email verification failed", error.message);
  }
};

// Resend verification email
const resendVerification = async (req, res) => {
  try {
    const userResult = await UserManager.findById(req.user._id);
    if (!userResult) {
      return sendError(res, 404, "User not found");
    }

    const { user } = userResult;

    if (user.isVerified) {
      return sendError(res, 400, "Email is already verified");
    }

    // Generate new 6-digit verification code
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();
    const verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    user.verificationCode = verificationCode;
    user.verificationCodeExpires = verificationCodeExpires;
    await user.save();

    // Send verification email
    await sendVerificationEmail(user, verificationCode);
    console.log(
      `🔐 New verification code for ${user.email}: ${verificationCode}`
    );

    sendSuccess(
      res,
      "Verification code sent successfully. Please check your email."
    );
  } catch (error) {
    console.error("Resend verification error:", error);
    sendError(res, 500, "Failed to resend verification code", error.message);
  }
};

// Resend verification code by email (public endpoint)
const resendVerificationByEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return sendError(res, 400, "Email address is required");
    }

    const userResult = await UserManager.findByEmail(email);
    if (!userResult) {
      return sendError(res, 404, "No user found with this email address");
    }

    const { user } = userResult;

    if (user.isVerified) {
      return sendError(res, 400, "Email is already verified");
    }

    // Generate new 6-digit verification code
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();
    const verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    user.verificationCode = verificationCode;
    user.verificationCodeExpires = verificationCodeExpires;
    await user.save();

    // Send verification email
    await sendVerificationEmail(user, verificationCode);
    console.log(`🔐 New verification code for ${email}: ${verificationCode}`);

    sendSuccess(
      res,
      "Verification code sent successfully. Please check your email."
    );
  } catch (error) {
    console.error("Resend verification by email error:", error);
    sendError(res, 500, "Failed to resend verification code", error.message);
  }
};

// Forgot password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const userResult = await UserManager.findByEmail(email);
    if (!userResult) {
      return sendError(res, 404, "No user found with this email address");
    }

    const { user } = userResult;

    // Generate reset token
    const resetToken = randomBytes(32).toString("hex");
    user.resetPasswordToken = createHash("sha256")
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
    const hashedToken = createHash("sha256").update(token).digest("hex");

    const userResult = await UserManager.findByResetToken(hashedToken);
    if (!userResult) {
      return sendError(res, 400, "Invalid or expired reset token");
    }

    const { user } = userResult;

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

    const userResult = await UserManager.findById(req.user._id);
    if (!userResult) {
      return sendError(res, 404, "User not found");
    }

    const { user } = userResult;

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
  resendVerificationByEmail,
  forgotPassword,
  resetPassword,
  changePassword,
  logout,
};
