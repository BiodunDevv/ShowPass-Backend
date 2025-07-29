const express = require("express");
const router = express.Router();
const bookingController = require("../controllers/bookingController");
const { requireAuth, isUser, isOrganizer } = require("../middlewares/auth");
const {
  validateBooking,
  validateObjectId,
} = require("../middlewares/validation");
const { param, body } = require("express-validator");

// @route   POST /api/booking
// @desc    Create new booking
// @access  Private (User)
router.post(
  "/",
  requireAuth,
  isUser,
  validateBooking,
  bookingController.createBooking
);

// @route   GET /api/booking/my-tickets
// @desc    Get user's bookings/tickets
// @access  Private (User)
router.get("/my-tickets", requireAuth, bookingController.getUserBookings);

// @route   GET /api/booking/:id
// @desc    Get booking by ID
// @access  Private (Owner/Organizer/Admin)
router.get(
  "/:id",
  validateObjectId(param("id")),
  requireAuth,
  bookingController.getBookingById
);

// @route   POST /api/booking/confirm-payment
// @desc    Confirm booking payment
// @access  Private
router.post(
  "/confirm-payment",
  [
    requireAuth,
    body("bookingId").isMongoId().withMessage("Valid booking ID is required"),
    body("paymentReference")
      .notEmpty()
      .withMessage("Payment reference is required"),
    body("paystackReference")
      .notEmpty()
      .withMessage("Paystack reference is required"),
  ],
  bookingController.confirmBookingPayment
);

// @route   PUT /api/booking/:id/cancel
// @desc    Cancel booking
// @access  Private (Owner only)
router.put(
  "/:id/cancel",
  [
    validateObjectId(param("id")),
    requireAuth,
    body("reason")
      .optional()
      .isLength({ min: 10, max: 200 })
      .withMessage("Reason must be between 10-200 characters"),
  ],
  bookingController.cancelBooking
);

// @route   PUT /api/booking/:id/checkin
// @desc    Check-in booking
// @access  Private (Organizer/Admin)
router.put(
  "/:id/checkin",
  validateObjectId(param("id")),
  requireAuth,
  isOrganizer,
  bookingController.checkInBooking
);

// @route   POST /api/booking/verify-qr
// @desc    Verify QR code for check-in
// @access  Private (Organizer/Admin)
router.post(
  "/verify-qr",
  [
    requireAuth,
    isOrganizer,
    body("qrCode").notEmpty().withMessage("QR code is required"),
  ],
  bookingController.verifyQRCode
);

module.exports = router;
