const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { requireAuth, isAdmin } = require("../middlewares/auth");
const { validateObjectId } = require("../middlewares/validation");
const { param, body } = require("express-validator");

// Dashboard and Analytics
// @route   GET /api/admin/dashboard
// @desc    Get dashboard statistics
// @access  Private (Admin)
router.get(
  "/dashboard",
  requireAuth,
  isAdmin,
  adminController.getDashboardStats
);

// @route   GET /api/admin/analytics
// @desc    Get platform analytics
// @access  Private (Admin)
router.get("/analytics", requireAuth, isAdmin, adminController.getAnalytics);

// User Management
// @route   GET /api/admin/users
// @desc    Get all users
// @access  Private (Admin)
router.get("/users", requireAuth, isAdmin, adminController.getAllUsers);

// @route   PUT /api/admin/users/:id/toggle-status
// @desc    Block/Unblock user
// @access  Private (Admin)
router.put(
  "/users/:id/toggle-status",
  [
    validateObjectId(param("id")),
    requireAuth,
    isAdmin,
    body("blocked").isBoolean().withMessage("Blocked status must be boolean"),
  ],
  adminController.toggleUserStatus
);

// Event Management
// @route   GET /api/admin/events
// @desc    Get all events (admin view)
// @access  Private (Admin)
router.get("/events", requireAuth, isAdmin, adminController.getAllEvents);

// @route   PUT /api/admin/events/:id/review
// @desc    Approve/Reject event
// @access  Private (Admin)
router.put(
  "/events/:id/review",
  [
    validateObjectId(param("id")),
    requireAuth,
    isAdmin,
    body("approved").isBoolean().withMessage("Approved status must be boolean"),
    body("rejectionReason")
      .optional()
      .isLength({ min: 10, max: 500 })
      .withMessage("Rejection reason must be between 10-500 characters"),
  ],
  adminController.reviewEvent
);

// @route   PUT /api/admin/events/:id/toggle-featured
// @desc    Toggle event featured status
// @access  Private (Admin)
router.put(
  "/events/:id/toggle-featured",
  [validateObjectId(param("id")), requireAuth, isAdmin],
  adminController.toggleEventFeatured
);

// Booking Management
// @route   GET /api/admin/bookings
// @desc    Get all bookings (admin view)
// @access  Private (Admin)
router.get("/bookings", requireAuth, isAdmin, adminController.getAllBookings);

// System Notifications
// @route   POST /api/admin/notifications/send
// @desc    Send system notification to users
// @access  Private (Admin)
router.post(
  "/notifications/send",
  [
    requireAuth,
    isAdmin,
    body("title").notEmpty().withMessage("Notification title is required"),
    body("message").notEmpty().withMessage("Notification message is required"),
    body("userType")
      .optional()
      .isIn(["all", "users", "organizers"])
      .withMessage("Invalid user type"),
  ],
  adminController.sendSystemNotification
);

module.exports = router;
