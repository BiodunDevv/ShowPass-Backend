const Booking = require("../models/Booking");
const Event = require("../models/Event");
const User = require("../models/User");
const {
  sendSuccess,
  sendError,
  getPagination,
  calculateFees,
} = require("../utils/helpers");
const { generateTicketQR } = require("../utils/qrGenerator");
const { sendTicketConfirmation } = require("../utils/emailService");

// Create booking (initiate ticket purchase)
const createBooking = async (req, res) => {
  try {
    const { eventId, ticketType, quantity, attendeeInfo } = req.body;

    // Get event
    const event = await Event.findById(eventId);
    if (!event) {
      return sendError(res, 404, "Event not found");
    }

    if (!event.approved) {
      return sendError(res, 400, "Event is not yet approved for booking");
    }

    // Check if event is in the future
    if (new Date(event.startDate) <= new Date()) {
      return sendError(res, 400, "Cannot book tickets for past events");
    }

    // Find ticket type
    const ticketTypeData = event.ticketTypes.find(
      (tt) => tt.name === ticketType
    );
    if (!ticketTypeData) {
      return sendError(res, 400, "Invalid ticket type");
    }

    // Check availability
    const availableTickets = ticketTypeData.quantity - ticketTypeData.sold;
    if (availableTickets < quantity) {
      return sendError(
        res,
        400,
        `Only ${availableTickets} tickets available for ${ticketType}`
      );
    }

    // Calculate total amount
    const ticketPrice = ticketTypeData.price;
    const subtotal = ticketPrice * quantity;
    const fees = calculateFees(subtotal);

    // Create booking
    const booking = new Booking({
      user: req.user._id,
      event: eventId,
      ticketType,
      quantity,
      totalAmount: subtotal,
      platformFee: fees.platformFee,
      vat: fees.vat,
      finalAmount: fees.finalAmount,
      attendeeInfo: {
        name: attendeeInfo.name || `${req.user.firstName} ${req.user.lastName}`,
        email: attendeeInfo.email || req.user.email,
        phone: attendeeInfo.phone || req.user.phone,
      },
    });

    await booking.save();
    await booking.populate([
      { path: "user", select: "firstName lastName email phone" },
      { path: "event", select: "title startDate endDate venue organizer" },
    ]);

    sendSuccess(
      res,
      "Booking created successfully. Proceed to payment.",
      booking
    );
  } catch (error) {
    console.error("Create booking error:", error);
    sendError(res, 500, "Failed to create booking", error.message);
  }
};

// Get user's bookings
const getUserBookings = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req);
    const { status, upcoming } = req.query;

    let query = { user: req.user._id };

    if (status) {
      query.status = status;
    }

    // Filter upcoming events
    if (upcoming === "true") {
      query["event.startDate"] = { $gte: new Date() };
    }

    const bookings = await Booking.find(query)
      .populate("event", "title startDate endDate venue images category")
      .populate("user", "firstName lastName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Booking.countDocuments(query);

    sendSuccess(res, "User bookings retrieved successfully", bookings, {
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get user bookings error:", error);
    sendError(res, 500, "Failed to retrieve bookings", error.message);
  }
};

// Get booking by ID
const getBookingById = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findById(id)
      .populate("user", "firstName lastName email phone")
      .populate(
        "event",
        "title description startDate endDate venue organizer category images"
      );

    if (!booking) {
      return sendError(res, 404, "Booking not found");
    }

    // Check if user owns the booking or is admin/organizer
    const isOwner = booking.user._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";
    const isOrganizer =
      booking.event.organizer.toString() === req.user._id.toString();

    if (!isOwner && !isAdmin && !isOrganizer) {
      return sendError(res, 403, "Access denied");
    }

    sendSuccess(res, "Booking retrieved successfully", booking);
  } catch (error) {
    console.error("Get booking error:", error);
    sendError(res, 500, "Failed to retrieve booking", error.message);
  }
};

// Confirm booking payment (called after successful payment)
const confirmBookingPayment = async (req, res) => {
  try {
    const { bookingId, paymentReference, paystackReference } = req.body;

    const booking = await Booking.findById(bookingId)
      .populate("user")
      .populate("event");

    if (!booking) {
      return sendError(res, 404, "Booking not found");
    }

    if (booking.status === "confirmed") {
      return sendError(res, 400, "Booking already confirmed");
    }

    // Update booking status
    booking.status = "confirmed";
    booking.paymentStatus = "paid";
    booking.paystackReference = paystackReference;

    // Generate QR code
    const { qrCode, qrCodeImage } = await generateTicketQR(booking);
    booking.qrCode = qrCode;
    booking.qrCodeImage = qrCodeImage;

    await booking.save();

    // Update event ticket sales
    const event = await Event.findById(booking.event._id);
    const ticketType = event.ticketTypes.find(
      (tt) => tt.name === booking.ticketType
    );
    if (ticketType) {
      ticketType.sold += booking.quantity;
      event.currentAttendees += booking.quantity;
      await event.save();
    }

    // Send confirmation email
    try {
      await sendTicketConfirmation(booking.user, booking, event, qrCodeImage);
    } catch (emailError) {
      console.error("Ticket email failed:", emailError);
    }

    sendSuccess(
      res,
      "Booking confirmed successfully! Check your email for ticket details.",
      booking
    );
  } catch (error) {
    console.error("Confirm booking error:", error);
    sendError(res, 500, "Failed to confirm booking", error.message);
  }
};

// Cancel booking
const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const booking = await Booking.findById(id).populate(
      "event",
      "title startDate organizer"
    );

    if (!booking) {
      return sendError(res, 404, "Booking not found");
    }

    // Check if user owns the booking
    if (booking.user.toString() !== req.user._id.toString()) {
      return sendError(res, 403, "You can only cancel your own bookings");
    }

    if (booking.status !== "confirmed") {
      return sendError(res, 400, "Only confirmed bookings can be cancelled");
    }

    if (booking.isCheckedIn) {
      return sendError(res, 400, "Cannot cancel booking after check-in");
    }

    // Check cancellation deadline (24 hours before event)
    const hoursUntilEvent =
      (new Date(booking.event.startDate) - new Date()) / (1000 * 60 * 60);
    if (hoursUntilEvent < 24) {
      return sendError(
        res,
        400,
        "Cannot cancel booking less than 24 hours before the event"
      );
    }

    // Update booking
    booking.status = "cancelled";
    booking.cancelledAt = new Date();
    booking.refundReason = reason;
    await booking.save();

    // Update event attendance count
    const event = await Event.findById(booking.event._id);
    event.currentAttendees -= booking.quantity;

    // Update ticket sales
    const ticketType = event.ticketTypes.find(
      (tt) => tt.name === booking.ticketType
    );
    if (ticketType) {
      ticketType.sold -= booking.quantity;
    }

    await event.save();

    sendSuccess(
      res,
      "Booking cancelled successfully. Refund will be processed within 3-5 business days."
    );
  } catch (error) {
    console.error("Cancel booking error:", error);
    sendError(res, 500, "Failed to cancel booking", error.message);
  }
};

// Check-in booking (organizer/admin only)
const checkInBooking = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findById(id)
      .populate("user", "firstName lastName email")
      .populate("event", "title organizer startDate");

    if (!booking) {
      return sendError(res, 404, "Booking not found");
    }

    // Check if user is organizer or admin
    const isOrganizer =
      booking.event.organizer.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isOrganizer && !isAdmin) {
      return sendError(
        res,
        403,
        "Only event organizers and admins can check-in attendees"
      );
    }

    if (booking.status !== "confirmed") {
      return sendError(res, 400, "Only confirmed bookings can be checked in");
    }

    if (booking.isCheckedIn) {
      return sendError(res, 400, "Booking already checked in");
    }

    // Update booking
    booking.isCheckedIn = true;
    booking.checkInTime = new Date();
    booking.checkedInBy = req.user._id;
    booking.status = "used";

    await booking.save();

    sendSuccess(res, "Attendee checked in successfully", {
      booking,
      attendee: booking.user,
      checkInTime: booking.checkInTime,
    });
  } catch (error) {
    console.error("Check-in booking error:", error);
    sendError(res, 500, "Failed to check-in booking", error.message);
  }
};

// Verify QR code for check-in
const verifyQRCode = async (req, res) => {
  try {
    const { qrCode } = req.body;

    if (!qrCode) {
      return sendError(res, 400, "QR code is required");
    }

    let qrData;
    try {
      qrData = JSON.parse(qrCode);
    } catch (error) {
      return sendError(res, 400, "Invalid QR code format");
    }

    const booking = await Booking.findById(qrData.bookingId)
      .populate("user", "firstName lastName email")
      .populate("event", "title organizer startDate venue");

    if (!booking) {
      return sendError(res, 404, "Booking not found");
    }

    // Check if user is organizer or admin
    const isOrganizer =
      booking.event.organizer.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isOrganizer && !isAdmin) {
      return sendError(res, 403, "Access denied");
    }

    // Verify QR data matches booking
    if (qrData.reference !== booking.paymentReference) {
      return sendError(res, 400, "QR code does not match booking");
    }

    if (booking.status !== "confirmed") {
      return sendError(res, 400, "Invalid booking status");
    }

    sendSuccess(res, "QR code verified successfully", {
      valid: true,
      booking: {
        _id: booking._id,
        ticketType: booking.ticketType,
        quantity: booking.quantity,
        attendee: booking.user,
        event: booking.event,
        isCheckedIn: booking.isCheckedIn,
        checkInTime: booking.checkInTime,
      },
    });
  } catch (error) {
    console.error("Verify QR code error:", error);
    sendError(res, 500, "Failed to verify QR code", error.message);
  }
};

module.exports = {
  createBooking,
  getUserBookings,
  getBookingById,
  confirmBookingPayment,
  cancelBooking,
  checkInBooking,
  verifyQRCode,
};
