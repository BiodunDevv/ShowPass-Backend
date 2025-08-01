const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { requireAuth } = require("../middlewares/auth");
const {
  validateRegister,
  validateLogin,
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
// @desc    Update user profile
// @access  Private
router.put("/profile", requireAuth, authController.updateProfile);

// @route   GET /api/auth/verify-email
// @desc    Verify email address
// @access  Public
router.get("/verify-email", authController.verifyEmail);

// @route   POST /api/auth/resend-verification
// @desc    Resend verification email
// @access  Private
router.post(
  "/resend-verification",
  requireAuth,
  authController.resendVerification
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

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post("/logout", requireAuth, authController.logout);

module.exports = router;
