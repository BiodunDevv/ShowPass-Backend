const Booking = require("../models/Booking");
const Event = require("../models/Event");
const UserManager = require("../utils/UserManager");
const {
  sendSuccess,
  sendError,
  getPagination,
  calculateFees,
  updateUserEventArrays,
} = require("../utils/helpers");
const {
  generateTicketQR,
  generateIndividualTicketQRs,
} = require("../utils/qrGenerator");
const {
  sendTicketConfirmation,
  sendTicketConfirmationToAttendees,
  sendIndividualTicketsAndConfirmation,
} = require("../utils/emailService");

// Create booking (direct booking after frontend payment)
const createBooking = async (req, res) => {
  try {
    const { eventId, ticketType, quantity, attendeeInfo, frontendPaymentId } =
      req.body;

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

    // Generate QR code immediately since payment is already processed
    const bookingData = {
      user: req.user._id,
      event: eventId,
      ticketType,
      quantity,
      totalAmount: subtotal,
      platformFee: fees.platformFee,
      vat: fees.vat,
      finalAmount: fees.finalAmount,
      frontendPaymentId, // Store frontend payment ID
    };

    // Prepare attendee info array
    let attendeeList = [];
    if (
      attendeeInfo &&
      Array.isArray(attendeeInfo) &&
      attendeeInfo.length > 0
    ) {
      attendeeList = attendeeInfo.slice(0, quantity); // Limit to quantity
    } else {
      // Default to booking user if no attendee info provided
      attendeeList = [
        {
          name: `${req.user.firstName} ${req.user.lastName}`,
          email: req.user.email,
          phone: req.user.phone || "",
        },
      ];
    }

    // Ensure we have enough attendee info for the quantity
    while (attendeeList.length < quantity) {
      attendeeList.push({
        name: `${req.user.firstName} ${req.user.lastName}`,
        email: req.user.email,
        phone: req.user.phone || "",
      });
    }

    // Create booking first (without QR codes)
    const booking = new Booking({
      ...bookingData,
      attendeeInfo: attendeeList,
    });

    await booking.save();
    await booking.populate([
      { path: "user", select: "firstName lastName email phone" },
      { path: "event", select: "title startDate endDate venue organizer" },
    ]);

    // Generate individual QR codes for each attendee
    const individualQRs = await generateIndividualTicketQRs(
      booking,
      attendeeList
    );

    // Update user spending tracking
    try {
      const userResult = await UserManager.findById(req.user._id);
      if (userResult && userResult.user) {
        const { user } = userResult;

        // Initialize purchaseHistory if it doesn't exist
        if (!user.purchaseHistory) {
          user.purchaseHistory = [];
        }

        // Update total spent
        user.totalSpent = (user.totalSpent || 0) + booking.finalAmount;

        // Add to purchase history
        user.purchaseHistory.push({
          eventId: booking.event._id,
          eventTitle: booking.event.title,
          amount: booking.finalAmount,
          ticketType: booking.ticketType,
          quantity: booking.quantity,
          date: new Date(),
          status: "completed",
        });

        await user.save();
        console.log(
          `💰 Updated user spending: ${user.email} - Total: ₦${user.totalSpent}`
        );
      }
    } catch (spendingError) {
      console.error("Failed to update user spending:", spendingError);
      // Don't fail the booking confirmation for spending tracking errors
    }

    // Update user's attending events array
    await updateUserEventArrays(req.user._id, booking.event._id, "attending");

    // Update event ticket sales
    const ticketType_obj = event.ticketTypes.find(
      (tt) => tt.name === booking.ticketType
    );
    if (ticketType_obj) {
      ticketType_obj.sold += booking.quantity;
      event.currentAttendees += booking.quantity;
      await event.save();
    }

    // Send individual ticket emails
    try {
      await sendIndividualTicketsAndConfirmation(
        booking.user,
        booking,
        event,
        individualQRs
      );
      console.log(
        `📧 Individual ticket confirmations sent for free event: ${event.title}`
      );
    } catch (emailError) {
      console.error("Ticket email failed:", emailError);
    }

    sendSuccess(
      res,
      "Booking completed successfully! Check your email for ticket details.",
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

// Register for free event
const registerForFreeEvent = async (req, res) => {
  try {
    const { eventId, ticketType, quantity, attendeeInfo } = req.body;

    // Get event
    const event = await Event.findById(eventId);
    if (!event) {
      return sendError(res, 404, "Event not found");
    }

    if (!event.approved) {
      return sendError(res, 400, "Event is not yet approved for registration");
    }

    if (!event.isFreeEvent) {
      return sendError(res, 400, "This endpoint is only for free events");
    }

    // Check if event is in the future
    if (new Date(event.startDate) <= new Date()) {
      return sendError(res, 400, "Cannot register for past events");
    }

    // Find ticket type
    const ticketTypeData = event.ticketTypes.find(
      (tt) => tt.name === ticketType
    );
    if (!ticketTypeData) {
      return sendError(res, 400, "Invalid ticket type");
    }

    if (!ticketTypeData.isFree && ticketTypeData.price > 0) {
      return sendError(res, 400, "This ticket type is not free");
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

    // Check for duplicate booking
    const existingBooking = await Booking.findOne({
      user: req.user._id,
      event: eventId,
      status: { $in: ["pending", "confirmed"] },
    });

    if (existingBooking) {
      return sendError(res, 400, "You have already registered for this event");
    }

    // Prepare attendee info array for free event
    let attendeeList = [];
    if (
      attendeeInfo &&
      Array.isArray(attendeeInfo) &&
      attendeeInfo.length > 0
    ) {
      attendeeList = attendeeInfo.slice(0, quantity); // Limit to quantity
    } else {
      // Default to booking user if no attendee info provided
      attendeeList = [
        {
          name: `${req.user.firstName} ${req.user.lastName}`,
          email: req.user.email,
          phone: req.user.phone || "",
        },
      ];
    }

    // Ensure we have enough attendee info for the quantity
    while (attendeeList.length < quantity) {
      attendeeList.push({
        name: `${req.user.firstName} ${req.user.lastName}`,
        email: req.user.email,
        phone: req.user.phone || "",
      });
    }

    // Create booking for free event (without QR codes)
    const booking = new Booking({
      user: req.user._id,
      event: eventId,
      ticketType,
      quantity,
      attendeeInfo: attendeeList,
      totalAmount: 0,
      finalAmount: 0,
      paymentStatus: "not_required",
      status: "confirmed", // Free events are auto-confirmed
    });

    await booking.save();

    // Populate booking for response
    await booking.populate("event", "title startDate venue");

    // Generate individual QR codes for each attendee
    const individualQRs = await generateIndividualTicketQRs(
      booking,
      attendeeList
    );

    // Update user's attending events array
    await updateUserEventArrays(req.user._id, eventId, "attending");

    // Update event ticket sales
    ticketTypeData.sold += quantity;
    event.currentAttendees += quantity;
    await event.save();

    // Send individual ticket confirmation emails
    try {
      await sendIndividualTicketsAndConfirmation(
        req.user,
        booking,
        event,
        individualQRs
      );
      console.log(
        `📧 Free event registration confirmations sent for: ${event.title}`
      );
    } catch (emailError) {
      console.log(
        "⚠️ Failed to send registration confirmation emails:",
        emailError.message
      );
    }

    sendSuccess(
      res,
      "Successfully registered for free event! Your tickets have been confirmed.",
      booking
    );
  } catch (error) {
    console.error("Register for free event error:", error);
    sendError(res, 500, "Failed to register for free event", error.message);
  }
};

module.exports = {
  createBooking,
  getUserBookings,
  getBookingById,
  cancelBooking,
  checkInBooking,
  verifyQRCode,
  registerForFreeEvent,
};
