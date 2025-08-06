const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { requireAuth } = require("../middlewares/auth");
const {
  validateRegister,
  validateLogin,
  validateComprehensiveProfile,
  validateSettings,
  validateAccountDeletion,
  validateAccountReactivation,
} = require("../middlewares/validation");

// @route   POST /api/auth/register
// @desc    Register new user
// @access  Public
router.post("/register", validateRegister, authController.register);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post("/login", validateLogin, authController.login);

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get("/me", requireAuth, authController.getMe);

// @route   PUT /api/auth/profile
// @desc    Update user profile (basic fields)
// @access  Private
router.put("/profile", requireAuth, authController.updateProfile);

// @route   PUT /api/auth/profile/comprehensive
// @desc    Update comprehensive user profile with role-specific fields
// @access  Private
router.put(
  "/profile/comprehensive",
  requireAuth,
  validateComprehensiveProfile,
  authController.updateComprehensiveProfile
);

// @route   GET /api/auth/settings
// @desc    Get user settings (notifications, preferences, privacy)
// @access  Private
router.get("/settings", requireAuth, authController.getSettings);

// @route   PUT /api/auth/settings
// @desc    Update user settings (notifications, preferences, privacy)
// @access  Private
router.put(
  "/settings",
  requireAuth,
  validateSettings,
  authController.updateSettings
);

// @route   DELETE /api/auth/account
// @desc    Delete user account (soft or hard delete)
// @access  Private
router.delete(
  "/account",
  requireAuth,
  validateAccountDeletion,
  authController.deleteAccount
);

// @route   POST /api/auth/reactivate
// @desc    Reactivate soft-deleted account
// @access  Public
router.post(
  "/reactivate",
  validateAccountReactivation,
  authController.reactivateAccount
);

// @route   POST /api/auth/verify-email
// @desc    Verify email address with 6-digit code
// @access  Public
router.post("/verify-email", authController.verifyEmail);

// @route   POST /api/auth/resend-verification
// @desc    Resend verification email (authenticated)
// @access  Private
router.post(
  "/resend-verification",
  requireAuth,
  authController.resendVerification
);

// @route   POST /api/auth/resend-verification-email
// @desc    Resend verification email by email address (public)
// @access  Public
router.post(
  "/resend-verification-email",
  authController.resendVerificationByEmail
);

// @route   POST /api/auth/forgot-password
// @desc    Request password reset
// @access  Public
router.post("/forgot-password", authController.forgotPassword);

// @route   POST /api/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post("/reset-password", authController.resetPassword);

// @route   PUT /api/auth/change-password
// @desc    Change password (authenticated user)
// @access  Private
router.put("/change-password", requireAuth, authController.changePassword);

// @route   GET /api/auth/check-auth
// @desc    Check if user is authenticated
// @access  Private
router.get("/check-auth", requireAuth, authController.checkAuth);

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post("/logout", requireAuth, authController.logout);

module.exports = router;
