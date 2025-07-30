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

// @route   GET /api/admin/users/search
// @desc    Search users by email, name, or other details
// @access  Private (Admin)
router.get("/users/search", requireAuth, isAdmin, adminController.searchUsers);

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

// @route   PUT /api/admin/users/:id/status
// @desc    Update user status (block/unblock)
// @access  Private (Admin)
router.put(
  "/users/:id/status",
  [
    validateObjectId(param("id")),
    requireAuth,
    isAdmin,
    body("blocked").isBoolean().withMessage("Blocked status must be boolean"),
  ],
  adminController.updateUserStatus
);

// Event Management
// @route   GET /api/admin/events/flagged
// @desc    Get events flagged for deletion
// @access  Private (Admin)
router.get(
  "/events/flagged",
  requireAuth,
  isAdmin,
  adminController.getFlaggedEvents
);

// @route   POST /api/admin/events/auto-delete
// @desc    Auto-delete overdue flagged events
// @access  Private (Admin)
router.post(
  "/events/auto-delete",
  requireAuth,
  isAdmin,
  adminController.autoDeleteOverdueEvents
);

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

// Event Warning System
// @route   POST /api/admin/events/:id/warn
// @desc    Send warning to organizer for event that doesn't meet standards
// @access  Private (Admin)
router.post(
  "/events/:id/warn",
  [
    validateObjectId(param("id")),
    requireAuth,
    isAdmin,
    body("reason")
      .notEmpty()
      .isLength({ min: 10, max: 1000 })
      .withMessage("Warning reason is required and must be 10-1000 characters"),
    body("severity")
      .optional()
      .isIn(["minor", "major", "critical"])
      .withMessage("Invalid severity level"),
    body("autoDeleteAfterDays")
      .optional()
      .isInt({ min: 1, max: 30 })
      .withMessage("Auto-delete days must be between 1-30"),
  ],
  adminController.warnOrganizer
);

// @route   PUT /api/admin/events/:id/unflag
// @desc    Remove deletion flag from event
// @access  Private (Admin)
router.put(
  "/events/:id/unflag",
  [validateObjectId(param("id")), requireAuth, isAdmin],
  adminController.unflagEvent
);

// @route   GET /api/admin/events/:id/warnings
// @desc    Get event warnings history
// @access  Private (Admin)
router.get(
  "/events/:id/warnings",
  [validateObjectId(param("id")), requireAuth, isAdmin],
  adminController.getEventWarnings
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
