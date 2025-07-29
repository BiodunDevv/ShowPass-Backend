const express = require("express");
const router = express.Router();
const refundController = require("../controllers/refundController");
const { requireAuth, isAdmin } = require("../middlewares/auth");
const {
  validateRefundRequest,
  validateObjectId,
} = require("../middlewares/validation");
const { param, body } = require("express-validator");

// @route   POST /api/refund/request
// @desc    Create refund request
// @access  Private (User)
router.post(
  "/request",
  requireAuth,
  validateRefundRequest,
  refundController.createRefundRequest
);

// @route   GET /api/refund/my-requests
// @desc    Get user's refund requests
// @access  Private (User)
router.get("/my-requests", requireAuth, refundController.getUserRefundRequests);

// @route   GET /api/refund/:id
// @desc    Get refund request by ID
// @access  Private (Owner/Admin/Organizer)
router.get(
  "/:id",
  validateObjectId(param("id")),
  requireAuth,
  refundController.getRefundRequestById
);

// @route   PUT /api/refund/:id/cancel
// @desc    Cancel refund request
// @access  Private (Owner only)
router.put(
  "/:id/cancel",
  validateObjectId(param("id")),
  requireAuth,
  refundController.cancelRefundRequest
);

// Admin routes
// @route   GET /api/refund/admin/all
// @desc    Get all refund requests (admin)
// @access  Private (Admin)
router.get(
  "/admin/all",
  requireAuth,
  isAdmin,
  refundController.getAllRefundRequests
);

// @route   PUT /api/refund/admin/:id/resolve
// @desc    Resolve refund request (admin)
// @access  Private (Admin)
router.put(
  "/admin/:id/resolve",
  [
    validateObjectId(param("id")),
    requireAuth,
    isAdmin,
    body("status")
      .isIn(["approved", "rejected"])
      .withMessage("Status must be approved or rejected"),
    body("adminResponse").notEmpty().withMessage("Admin response is required"),
  ],
  refundController.resolveRefundRequest
);

module.exports = router;
