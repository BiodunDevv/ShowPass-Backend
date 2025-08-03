const { body, validationResult, param, query } = require("express-validator");

// Helper function to handle validation errors
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation errors",
      errors: errors.array(),
    });
  }
  next();
};

// User registration validation
const validateRegister = [
  body("firstName")
    .trim()
    .notEmpty()
    .withMessage("First name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must be between 2 and 50 characters"),

  body("lastName")
    .trim()
    .notEmpty()
    .withMessage("Last name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("Last name must be between 2 and 50 characters"),

  body("email").isEmail().withMessage("Please provide a valid email"),

  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "Password must contain at least one lowercase letter, one uppercase letter, and one number"
    ),

  body("role")
    .optional()
    .isIn(["user", "organizer"])
    .withMessage("Role must be either user or organizer"),

  handleValidation,
];

// User login validation
const validateLogin = [
  body("email").isEmail().withMessage("Please provide a valid email"),

  body("password").notEmpty().withMessage("Password is required"),

  handleValidation,
];

// Event creation validation
const validateEvent = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Event title is required")
    .isLength({ min: 5, max: 200 })
    .withMessage("Event title must be between 5 and 200 characters"),

  body("description")
    .trim()
    .notEmpty()
    .withMessage("Event description is required")
    .isLength({ min: 20, max: 2000 })
    .withMessage("Event description must be between 20 and 2000 characters"),

  body("category")
    .isIn([
      "Music",
      "Sports",
      "Technology",
      "Business",
      "Education",
      "Entertainment",
      "Arts",
      "Food",
      "Health",
      "Other",
    ])
    .withMessage("Please select a valid category"),

  body("venue.name").trim().notEmpty().withMessage("Venue name is required"),

  body("venue.address")
    .trim()
    .notEmpty()
    .withMessage("Venue address is required"),

  body("venue.city").trim().notEmpty().withMessage("Venue city is required"),

  body("venue.state").trim().notEmpty().withMessage("Venue state is required"),

  body("startDate")
    .isISO8601()
    .withMessage("Please provide a valid start date")
    .custom((value) => {
      if (new Date(value) <= new Date()) {
        throw new Error("Start date must be in the future");
      }
      return true;
    }),

  body("endDate")
    .isISO8601()
    .withMessage("Please provide a valid end date")
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.startDate)) {
        throw new Error("End date must be after start date");
      }
      return true;
    }),

  body("startTime")
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("Please provide a valid start time (HH:MM format)"),

  body("endTime")
    .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("Please provide a valid end time (HH:MM format)"),

  body("ticketTypes")
    .isArray({ min: 1 })
    .withMessage("At least one ticket type is required"),

  body("ticketTypes.*.name")
    .isIn(["VIP", "Regular", "Premium", "Standard", "Early Bird", "Free"])
    .withMessage("Invalid ticket type"),

  body("ticketTypes.*.price")
    .isFloat({ min: 0 })
    .withMessage("Ticket price must be a positive number"),

  body("ticketTypes.*.quantity")
    .isInt({ min: 1 })
    .withMessage("Ticket quantity must be at least 1"),

  handleValidation,
];

// Booking validation
const validateBooking = [
  body("eventId").isMongoId().withMessage("Please provide a valid event ID"),

  body("ticketType").trim().notEmpty().withMessage("Ticket type is required"),

  body("quantity")
    .isInt({ min: 1, max: 10 })
    .withMessage("Quantity must be between 1 and 10"),

  body("frontendPaymentId")
    .trim()
    .notEmpty()
    .withMessage("Frontend payment ID is required"),

  body("attendeeInfo.name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Attendee name cannot be empty if provided"),

  body("attendeeInfo.email")
    .optional()
    .isEmail()
    .withMessage("Please provide a valid attendee email")
    .normalizeEmail(),

  body("attendeeInfo.phone")
    .optional()
    .isMobilePhone()
    .withMessage("Please provide a valid phone number"),

  handleValidation,
];

// Refund request validation
const validateRefundRequest = [
  body("bookingId")
    .isMongoId()
    .withMessage("Please provide a valid booking ID"),

  body("reason")
    .isIn([
      "Event cancelled by organizer",
      "Unable to attend",
      "Duplicate booking",
      "Event details changed significantly",
      "Medical emergency",
      "Travel restrictions",
      "Other",
    ])
    .withMessage("Please select a valid refund reason"),

  body("description")
    .trim()
    .notEmpty()
    .withMessage("Please provide details about your refund request")
    .isLength({ min: 10, max: 500 })
    .withMessage("Description must be between 10 and 500 characters"),

  handleValidation,
];

// MongoDB ObjectId validation
const validateObjectId = (param) => [
  param.isMongoId().withMessage("Please provide a valid ID"),
  handleValidation,
];

module.exports = {
  validateRegister,
  validateLogin,
  validateEvent,
  validateBooking,
  validateRefundRequest,
  validateObjectId,
  handleValidation,
};
