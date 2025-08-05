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
// @desc    Create new booking (direct booking after frontend payment)
// @access  Private (User)
router.post(
  "/",
  [
    requireAuth,
    isUser,
    body("eventId").isMongoId().withMessage("Valid event ID is required"),
    body("ticketType").notEmpty().withMessage("Ticket type is required"),
    body("quantity")
      .isInt({ min: 1, max: 10 })
      .withMessage("Quantity must be between 1 and 10"),
    body("frontendPaymentId")
      .notEmpty()
      .withMessage("Frontend payment ID is required"),
    body("attendeeInfo")
      .optional()
      .custom((value) => {
        if (
          Array.isArray(value) ||
          (typeof value === "object" && value !== null)
        ) {
          return true;
        }
        throw new Error("Attendee info must be an array or object");
      }),
  ],
  bookingController.createBooking
);

// @route   POST /api/booking/free-event
// @desc    Register for free event
// @access  Private (User)
router.post(
  "/free-event",
  [
    requireAuth,
    body("eventId").isMongoId().withMessage("Valid event ID is required"),
    body("ticketType").notEmpty().withMessage("Ticket type is required"),
    body("quantity")
      .isInt({ min: 1, max: 10 })
      .withMessage("Quantity must be between 1 and 10"),
    body("attendeeInfo")
      .optional()
      .isArray()
      .withMessage("Attendee info must be an array"),
  ],
  bookingController.registerForFreeEvent
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

// @route   POST /api/booking/checkin-ticket
// @desc    Check-in individual ticket using QR code
// @access  Private (Organizer/Admin)
router.post(
  "/checkin-ticket",
  [
    requireAuth,
    isOrganizer,
    body("qrCode").notEmpty().withMessage("QR code is required"),
  ],
  bookingController.checkInIndividualTicket
);

// @route   GET /api/booking/debug/:id
// @desc    Debug individual QRs for a booking (temporary)
// @access  Private
router.get(
  "/debug/:id",
  validateObjectId(param("id")),
  requireAuth,
  bookingController.debugBookingQRs
);

module.exports = router;
