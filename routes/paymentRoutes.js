const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/paymentController");
const { requireAuth } = require("../middlewares/auth");
const { body, param } = require("express-validator");

// @route   POST /api/payment/initiate
// @desc    Initialize payment with Paystack
// @access  Private
router.post(
  "/initiate",
  [
    requireAuth,
    body("bookingId").isMongoId().withMessage("Valid booking ID is required"),
  ],
  paymentController.initiatePayment
);

// @route   GET /api/payment/verify
// @desc    Verify payment callback
// @access  Public (Paystack callback)
router.get("/verify", paymentController.verifyPaymentCallback);

// @route   POST /api/payment/webhook
// @desc    Handle Paystack webhook
// @access  Public (Paystack webhook)
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  paymentController.handleWebhook
);

// @route   GET /api/payment/status/:reference
// @desc    Get payment status
// @access  Private
router.get(
  "/status/:reference",
  [
    requireAuth,
    param("reference").notEmpty().withMessage("Payment reference is required"),
  ],
  paymentController.getPaymentStatus
);

// @route   GET /api/payment/history
// @desc    Get user's payment history
// @access  Private
router.get("/history", requireAuth, paymentController.getPaymentHistory);

module.exports = router;
