const UserManager = require("../utils/UserManager");
const Event = require("../models/Event");
const Booking = require("../models/Booking");
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

// Update comprehensive profile with role-specific fields
const updateComprehensiveProfile = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      phone,
      dateOfBirth,
      address,
      bio,
      website,
      socialLinks,
      preferences,
      notifications,
      // Organizer specific fields
      businessName,
      businessAddress,
      businessPhone,
      businessWebsite,
      // Admin specific fields
      department,
      position,
    } = req.body;

    const userResult = await UserManager.findById(req.user._id);
    if (!userResult) {
      return sendError(res, 404, "User not found");
    }

    const { user } = userResult;

    // Update basic fields for all users
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (phone !== undefined) user.phone = phone;
    if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth;
    if (address !== undefined) user.address = address;
    if (bio !== undefined) user.bio = bio;
    if (website !== undefined) user.website = website;
    if (socialLinks !== undefined) user.socialLinks = socialLinks;

    // Update preferences and notifications
    if (preferences !== undefined) {
      user.preferences = { ...user.preferences, ...preferences };
    }
    if (notifications !== undefined) {
      user.notifications = { ...user.notifications, ...notifications };
    }

    // Role-specific updates
    if (user.role === "organizer") {
      if (businessName !== undefined) user.businessName = businessName;
      if (businessAddress !== undefined) user.businessAddress = businessAddress;
      if (businessPhone !== undefined) user.businessPhone = businessPhone;
      if (businessWebsite !== undefined) user.businessWebsite = businessWebsite;
    }

    if (user.role === "admin") {
      if (department !== undefined) user.department = department;
      if (position !== undefined) user.position = position;
    }

    await user.save();

    sendSuccess(res, "Profile updated successfully", sanitizeUser(user));
  } catch (error) {
    console.error("Comprehensive profile update error:", error);
    sendError(res, 500, "Failed to update profile", error.message);
  }
};

// Update user settings (notifications, preferences, privacy)
const updateSettings = async (req, res) => {
  try {
    const { notifications, preferences, privacy, theme, language, timezone } =
      req.body;

    const userResult = await UserManager.findById(req.user._id);
    if (!userResult) {
      return sendError(res, 404, "User not found");
    }

    const { user } = userResult;

    // Update notification settings
    if (notifications !== undefined) {
      user.notifications = {
        email:
          notifications.email !== undefined
            ? notifications.email
            : user.notifications?.email || true,
        push:
          notifications.push !== undefined
            ? notifications.push
            : user.notifications?.push || true,
        sms:
          notifications.sms !== undefined
            ? notifications.sms
            : user.notifications?.sms || false,
        newEvents:
          notifications.newEvents !== undefined
            ? notifications.newEvents
            : user.notifications?.newEvents || true,
        eventUpdates:
          notifications.eventUpdates !== undefined
            ? notifications.eventUpdates
            : user.notifications?.eventUpdates || true,
        eventReminders:
          notifications.eventReminders !== undefined
            ? notifications.eventReminders
            : user.notifications?.eventReminders || true,
        promotions:
          notifications.promotions !== undefined
            ? notifications.promotions
            : user.notifications?.promotions || false,
        newsletter:
          notifications.newsletter !== undefined
            ? notifications.newsletter
            : user.notifications?.newsletter || false,
      };
    }

    // Update preferences
    if (preferences !== undefined) {
      user.preferences = {
        favoriteCategories:
          preferences.favoriteCategories ||
          user.preferences?.favoriteCategories ||
          [],
        eventNotificationRadius:
          preferences.eventNotificationRadius ||
          user.preferences?.eventNotificationRadius ||
          50,
        autoAcceptBookings:
          preferences.autoAcceptBookings !== undefined
            ? preferences.autoAcceptBookings
            : user.preferences?.autoAcceptBookings || false,
        showProfile:
          preferences.showProfile !== undefined
            ? preferences.showProfile
            : user.preferences?.showProfile || true,
        allowMessages:
          preferences.allowMessages !== undefined
            ? preferences.allowMessages
            : user.preferences?.allowMessages || true,
        ...preferences,
      };
    }

    // Update privacy settings
    if (privacy !== undefined) {
      user.privacy = {
        showEmail:
          privacy.showEmail !== undefined
            ? privacy.showEmail
            : user.privacy?.showEmail || false,
        showPhone:
          privacy.showPhone !== undefined
            ? privacy.showPhone
            : user.privacy?.showPhone || false,
        showAttendingEvents:
          privacy.showAttendingEvents !== undefined
            ? privacy.showAttendingEvents
            : user.privacy?.showAttendingEvents || true,
        profileVisibility:
          privacy.profileVisibility ||
          user.privacy?.profileVisibility ||
          "public",
        ...privacy,
      };
    }

    // Update UI settings
    if (theme !== undefined) user.theme = theme;
    if (language !== undefined) user.language = language;
    if (timezone !== undefined) user.timezone = timezone;

    await user.save();

    sendSuccess(res, "Settings updated successfully", {
      notifications: user.notifications,
      preferences: user.preferences,
      privacy: user.privacy,
      theme: user.theme,
      language: user.language,
      timezone: user.timezone,
    });
  } catch (error) {
    console.error("Settings update error:", error);
    sendError(res, 500, "Failed to update settings", error.message);
  }
};

// Get user settings
const getSettings = async (req, res) => {
  try {
    const userResult = await UserManager.findById(req.user._id);
    if (!userResult) {
      return sendError(res, 404, "User not found");
    }

    const { user } = userResult;

    const settings = {
      notifications: user.notifications || {
        email: true,
        push: true,
        sms: false,
        newEvents: true,
        eventUpdates: true,
        eventReminders: true,
        promotions: false,
        newsletter: false,
      },
      preferences: user.preferences || {
        favoriteCategories: [],
        eventNotificationRadius: 50,
        autoAcceptBookings: false,
        showProfile: true,
        allowMessages: true,
      },
      privacy: user.privacy || {
        showEmail: false,
        showPhone: false,
        showAttendingEvents: true,
        profileVisibility: "public",
      },
      theme: user.theme || "light",
      language: user.language || "en",
      timezone: user.timezone || "UTC",
    };

    sendSuccess(res, "Settings retrieved successfully", settings);
  } catch (error) {
    console.error("Get settings error:", error);
    sendError(res, 500, "Failed to retrieve settings", error.message);
  }
};

// Delete user account (soft delete with option for hard delete)
const deleteAccount = async (req, res) => {
  try {
    const { confirmPassword, deleteType = "soft", reason } = req.body;

    if (!confirmPassword) {
      return sendError(res, 400, "Password confirmation is required");
    }

    const userResult = await UserManager.findById(req.user._id);
    if (!userResult) {
      return sendError(res, 404, "User not found");
    }

    const { user } = userResult;

    // Verify password
    const isPasswordValid = await user.comparePassword(confirmPassword);
    if (!isPasswordValid) {
      return sendError(res, 400, "Incorrect password");
    }

    if (deleteType === "soft") {
      // Soft delete - deactivate account
      user.isDeleted = true;
      user.deletedAt = new Date();
      user.deletionReason = reason || "User requested deletion";
      user.blocked = true; // Block account to prevent login

      // Anonymize sensitive data but keep for business records
      user.email = `deleted_${user._id}@deleted.com`;
      user.phone = null;
      user.firstName = "Deleted";
      user.lastName = "User";

      await user.save();

      sendSuccess(
        res,
        "Account deactivated successfully. You can reactivate within 30 days by contacting support."
      );
    } else if (deleteType === "hard") {
      // Hard delete - only for non-organizers or organizers with no active events
      if (user.role === "organizer") {
        const activeEvents = await Event.countDocuments({
          organizer: user._id,
          startDate: { $gte: new Date() },
          status: { $in: ["approved", "pending"] },
        });

        if (activeEvents > 0) {
          return sendError(
            res,
            400,
            "Cannot delete account with active or upcoming events. Please cancel or transfer your events first."
          );
        }
      }

      // Check for recent bookings
      const recentBookings = await Booking.countDocuments({
        user: user._id,
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Last 30 days
        status: "confirmed",
      });

      if (recentBookings > 0) {
        return sendError(
          res,
          400,
          "Cannot permanently delete account with recent bookings. Please wait 30 days or choose soft delete."
        );
      }

      // Hard delete - remove all user data
      await UserManager.deleteUser(user._id);

      sendSuccess(
        res,
        "Account permanently deleted. All data has been removed."
      );
    } else {
      return sendError(
        res,
        400,
        "Invalid deletion type. Use 'soft' or 'hard'."
      );
    }
  } catch (error) {
    console.error("Delete account error:", error);
    sendError(res, 500, "Failed to delete account", error.message);
  }
};

// Reactivate soft-deleted account
const reactivateAccount = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return sendError(res, 400, "Email and password are required");
    }

    const userResult = await UserManager.findByEmail(email);
    if (!userResult) {
      return sendError(res, 404, "Account not found");
    }

    const { user } = userResult;

    if (!user.isDeleted) {
      return sendError(res, 400, "Account is not deleted");
    }

    // Check if within reactivation period (30 days)
    const deletionDate = new Date(user.deletedAt);
    const reactivationDeadline = new Date(
      deletionDate.getTime() + 30 * 24 * 60 * 60 * 1000
    );

    if (new Date() > reactivationDeadline) {
      return sendError(
        res,
        400,
        "Reactivation period has expired. Please contact support."
      );
    }

    // Verify password (this might not work if email was anonymized)
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return sendError(res, 400, "Invalid credentials");
    }

    // Reactivate account
    user.isDeleted = false;
    user.deletedAt = null;
    user.deletionReason = null;
    user.blocked = false;
    user.email = email; // Restore original email

    await user.save();

    const token = generateToken(user._id);

    sendSuccess(res, "Account reactivated successfully", {
      user: sanitizeUser(user),
      token,
    });
  } catch (error) {
    console.error("Reactivate account error:", error);
    sendError(res, 500, "Failed to reactivate account", error.message);
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

// Check authentication status
const checkAuth = async (req, res) => {
  try {
    // If we reach here, the user is authenticated (middleware passed)
    const userResult = await UserManager.findById(req.user._id);
    if (!userResult) {
      return sendError(res, 404, "User not found");
    }

    const { user } = userResult;

    sendSuccess(res, "User is authenticated", {
      isAuthenticated: true,
      user: sanitizeUser(user),
      authStatus: "verified",
    });
  } catch (error) {
    console.error("Check auth error:", error);
    sendError(
      res,
      500,
      "Failed to verify authentication status",
      error.message
    );
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
  updateComprehensiveProfile,
  updateSettings,
  getSettings,
  deleteAccount,
  reactivateAccount,
  verifyEmail,
  resendVerification,
  resendVerificationByEmail,
  forgotPassword,
  resetPassword,
  changePassword,
  checkAuth,
  logout,
};
