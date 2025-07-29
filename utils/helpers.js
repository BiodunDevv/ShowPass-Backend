const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

// Generate random token for email verification
const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

// Calculate platform fees
const calculateFees = (amount) => {
  const platformServiceFeePercent =
    parseFloat(process.env.PLATFORM_SERVICE_FEE_PERCENT) || 5;
  const platformVATPercent =
    parseFloat(process.env.PLATFORM_VAT_PERCENT) || 7.5;

  const platformFee = (amount * platformServiceFeePercent) / 100;
  const vat = (platformFee * platformVATPercent) / 100;
  const totalFees = platformFee + vat;
  const finalAmount = amount + totalFees;

  return {
    originalAmount: amount,
    platformFee: Math.round(platformFee * 100) / 100,
    vat: Math.round(vat * 100) / 100,
    totalFees: Math.round(totalFees * 100) / 100,
    finalAmount: Math.round(finalAmount * 100) / 100,
  };
};

// Format currency
const formatCurrency = (amount, currency = "NGN") => {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: currency,
  }).format(amount);
};

// Generate unique reference
const generateReference = (prefix = "SP") => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 5).toUpperCase();
  return `${prefix}${timestamp}${random}`;
};

// Validate date is in future
const isDateInFuture = (date) => {
  return new Date(date) > new Date();
};

// Calculate time difference in hours
const getHoursDifference = (date1, date2) => {
  const diffTime = Math.abs(new Date(date2) - new Date(date1));
  return diffTime / (1000 * 60 * 60);
};

// Sanitize user data for response
const sanitizeUser = (user) => {
  const { password, verificationToken, resetPasswordToken, ...sanitizedUser } =
    user.toObject();
  return sanitizedUser;
};

// Pagination helper
const getPagination = (req) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

// API Response helper
const sendResponse = (
  res,
  statusCode,
  success,
  message,
  data = null,
  meta = null
) => {
  const response = { success, message };

  if (data !== null) response.data = data;
  if (meta !== null) response.meta = meta;

  return res.status(statusCode).json(response);
};

// Error response helper
const sendError = (res, statusCode, message, errors = null) => {
  const response = { success: false, message };

  if (errors) response.errors = errors;

  return res.status(statusCode).json(response);
};

// Success response helper
const sendSuccess = (res, message, data = null, meta = null) => {
  return sendResponse(res, 200, true, message, data, meta);
};

// Update user event arrays
const updateUserEventArrays = async (userId, eventId, action) => {
  try {
    const UserManager = require("./UserManager");
    return await UserManager.updateUserEventArrays(userId, eventId, action);
  } catch (error) {
    console.error("Error updating user event arrays:", error);
    return false;
  }
};

// Check if event is free
const checkEventIsFree = (ticketTypes) => {
  return ticketTypes.every(
    (ticket) => ticket.price === 0 || ticket.isFree === true
  );
};

// Validate free event ticket types
const validateFreeEventTickets = (ticketTypes) => {
  const errors = [];

  ticketTypes.forEach((ticket, index) => {
    if (ticket.isFree && ticket.price > 0) {
      errors.push(
        `Ticket type ${
          index + 1
        }: Cannot have price greater than 0 for free tickets`
      );
    }
    if (ticket.price === 0) {
      ticket.isFree = true;
    }
  });

  return { isValid: errors.length === 0, errors };
};

module.exports = {
  generateToken,
  generateVerificationToken,
  calculateFees,
  formatCurrency,
  generateReference,
  isDateInFuture,
  getHoursDifference,
  sanitizeUser,
  getPagination,
  sendResponse,
  sendError,
  sendSuccess,
  updateUserEventArrays,
  checkEventIsFree,
  validateFreeEventTickets,
};
