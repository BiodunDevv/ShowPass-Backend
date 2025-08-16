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
  sendTicketUsageNotification,
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

    // Save individual QR codes to the booking
    booking.individualQRs = individualQRs;
    booking.markModified("individualQRs"); // Ensure MongoDB knows the field changed
    await booking.save();

    console.log(
      `✅ Saved ${individualQRs.length} individual QR codes to booking ${booking._id}`
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

    // Debug logging
    console.log(
      `📊 Retrieved ${bookings.length} bookings for user ${req.user._id}`
    );
    bookings.forEach((booking, index) => {
      console.log(
        `📋 Booking ${index + 1}: ID=${booking._id}, individualQRs count=${
          booking.individualQRs?.length || 0
        }`
      );
    });

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

    console.log(
      `📋 Retrieved booking ${id}: individualQRs count=${
        booking.individualQRs?.length || 0
      }`
    );
    if (booking.individualQRs && booking.individualQRs.length > 0) {
      console.log(
        `🎫 Individual QRs:`,
        booking.individualQRs.map((qr) => ({
          ticketNumber: qr.ticketNumber,
          reference: qr.reference,
          attendeeName: qr.attendee?.name,
          hasQRImage: !!qr.qrCodeImage,
        }))
      );
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

// Verify QR code for check-in (updated for individual tickets)
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

    // Find booking by ID and populate necessary fields
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

    // Find the specific ticket in individual QRs
    const ticketQR = booking.individualQRs.find(
      (qr) => qr.reference === qrData.ticketReference
    );

    if (!ticketQR) {
      return sendError(res, 400, "Invalid ticket reference");
    }

    // Verify QR data matches the specific ticket
    if (
      qrData.attendeeName !== ticketQR.attendee.name ||
      qrData.hash !== ticketQR.hash
    ) {
      return sendError(res, 400, "QR code verification failed");
    }

    if (booking.status !== "confirmed") {
      return sendError(res, 400, "Invalid booking status");
    }

    // Check if this specific ticket is already used
    if (ticketQR.isUsed) {
      return sendError(res, 400, "This ticket has already been used");
    }

    sendSuccess(res, "QR code verified successfully", {
      valid: true,
      ticket: {
        ticketNumber: ticketQR.ticketNumber,
        reference: ticketQR.reference,
        attendeeName: ticketQR.attendee.name,
        attendeeEmail: ticketQR.attendee.email,
        ticketType: booking.ticketType,
        isUsed: ticketQR.isUsed || false,
      },
      booking: {
        _id: booking._id,
        quantity: booking.quantity,
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

// Check-in individual ticket (updated for individual QR codes)
const checkInIndividualTicket = async (req, res) => {
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

    // Find booking and populate necessary fields
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
      return sendError(
        res,
        403,
        "Only event organizers and admins can check-in attendees"
      );
    }

    // Find the specific ticket
    const ticketIndex = booking.individualQRs.findIndex(
      (qr) => qr.reference === qrData.ticketReference
    );

    if (ticketIndex === -1) {
      return sendError(res, 400, "Invalid ticket reference");
    }

    const ticket = booking.individualQRs[ticketIndex];

    // Verify QR data
    if (
      qrData.attendeeName !== ticket.attendee.name ||
      qrData.hash !== ticket.hash
    ) {
      return sendError(res, 400, "QR code verification failed");
    }

    if (booking.status !== "confirmed") {
      return sendError(res, 400, "Only confirmed bookings can be checked in");
    }

    if (ticket.isUsed) {
      return sendError(res, 400, "This ticket has already been used");
    }

    // Mark the individual ticket as used
    booking.individualQRs[ticketIndex].isUsed = true;
    booking.individualQRs[ticketIndex].checkInTime = new Date();
    booking.individualQRs[ticketIndex].checkedInBy = req.user._id;

    // Check if all tickets in this booking are now used
    const allTicketsUsed = booking.individualQRs.every((qr) => qr.isUsed);
    if (allTicketsUsed) {
      booking.isCheckedIn = true;
      booking.checkInTime = new Date();
      booking.checkedInBy = req.user._id;
      booking.status = "used";
    }

    await booking.save();

    // Send email notification to the user
    try {
      const checkedInBy = {
        firstName: req.user.firstName,
        lastName: req.user.lastName,
      };

      await sendTicketUsageNotification(
        booking.user,
        booking.individualQRs[ticketIndex],
        booking,
        booking.event,
        checkedInBy
      );

      console.log(`📧 Ticket usage notification sent to ${booking.user.email}`);
    } catch (emailError) {
      console.error("Failed to send ticket usage notification:", emailError);
      // Don't fail the check-in if email fails
    }

    sendSuccess(
      res,
      "Ticket checked in successfully! Email notification sent.",
      {
        ticket: {
          ticketNumber: ticket.ticketNumber,
          reference: ticket.reference,
          attendeeName: ticket.attendee.name,
          checkInTime: ticket.checkInTime,
          isUsed: ticket.isUsed,
        },
        booking: {
          _id: booking._id,
          allTicketsUsed,
          totalTickets: booking.individualQRs.length,
          usedTickets: booking.individualQRs.filter((qr) => qr.isUsed).length,
        },
      }
    );
  } catch (error) {
    console.error("Check-in individual ticket error:", error);
    sendError(res, 500, "Failed to check-in ticket", error.message);
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
      paymentStatus: "paid", // Use "paid" for free events since no payment is required
      paymentReference: `FREE-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase()}`, // Generate unique reference for free events
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

    // Save individual QR codes to the booking
    booking.individualQRs = individualQRs;
    booking.markModified("individualQRs"); // Ensure MongoDB knows the field changed
    await booking.save();

    console.log(
      `✅ Saved ${individualQRs.length} individual QR codes to free event booking ${booking._id}`
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

// Debug endpoint to check individual QRs (temporary)
const debugBookingQRs = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findById(id);

    if (!booking) {
      return sendError(res, 404, "Booking not found");
    }

    console.log("🔍 Debug booking QRs:");
    console.log("📋 Booking ID:", booking._id);
    console.log("🎫 Individual QRs count:", booking.individualQRs?.length || 0);
    console.log("📊 Full individualQRs data:", booking.individualQRs);

    sendSuccess(res, "Debug info retrieved", {
      bookingId: booking._id,
      individualQRsCount: booking.individualQRs?.length || 0,
      individualQRs: booking.individualQRs,
      hasIndividualQRs: !!booking.individualQRs,
      isArray: Array.isArray(booking.individualQRs),
    });
  } catch (error) {
    console.error("Debug booking QRs error:", error);
    sendError(res, 500, "Failed to debug booking QRs", error.message);
  }
};

// Verify QR code and mark ticket as used (for camera scanning)
const verifyAndUseTicket = async (req, res) => {
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

    // Validate QR code structure
    if (!qrData.bookingId || !qrData.ticketReference) {
      return sendError(
        res,
        400,
        "Invalid QR code data - missing required fields"
      );
    }

    // Extract event ID - handle both string and object formats
    let eventIdToCheck;
    if (typeof qrData.eventId === "string") {
      eventIdToCheck = qrData.eventId;
    } else if (qrData.eventId && qrData.eventId._id) {
      eventIdToCheck = qrData.eventId._id;
    } else if (qrData.eventId && qrData.eventId.id) {
      eventIdToCheck = qrData.eventId.id;
    }

    // Extract user ID - handle both string and object formats
    let userIdToCheck;
    if (typeof qrData.userId === "string") {
      userIdToCheck = qrData.userId;
    } else if (qrData.userId && qrData.userId._id) {
      userIdToCheck = qrData.userId._id;
    } else if (qrData.userId && qrData.userId.id) {
      userIdToCheck = qrData.userId.id;
    }

    console.log("🔍 QR Verification Debug:");
    console.log("- Booking ID:", qrData.bookingId);
    console.log("- Ticket Reference:", qrData.ticketReference);
    console.log("- Event ID (extracted):", eventIdToCheck);
    console.log("- User ID (extracted):", userIdToCheck);
    console.log("- Attendee Name:", qrData.attendeeName);
    console.log("- Attendee Email:", qrData.attendeeEmail);

    // Find booking and populate necessary fields
    const booking = await Booking.findById(qrData.bookingId)
      .populate("user", "firstName lastName email")
      .populate("event", "title organizer startDate endDate venue");

    if (!booking) {
      return sendError(res, 404, "Booking not found");
    }

    console.log("📋 Booking Found:");
    console.log("- Booking Event ID:", booking.event._id.toString());
    console.log("- Booking User ID:", booking.user._id.toString());
    console.log("- Event Organizer ID:", booking.event.organizer.toString());
    console.log("- Current User ID:", req.user._id.toString());

    // Verify that the QR code belongs to this booking's event and user
    if (eventIdToCheck && booking.event._id.toString() !== eventIdToCheck) {
      return sendError(res, 400, "QR code event does not match booking event");
    }

    if (userIdToCheck && booking.user._id.toString() !== userIdToCheck) {
      return sendError(res, 400, "QR code user does not match booking user");
    }

    // Check if user is organizer or admin
    const isOrganizer =
      booking.event.organizer.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    console.log("🔐 Authorization Check:");
    console.log("- Is Organizer:", isOrganizer);
    console.log("- Is Admin:", isAdmin);
    console.log("- User Role:", req.user.role);

    if (!isOrganizer && !isAdmin) {
      return sendError(
        res,
        403,
        "Only event organizers and admins can verify tickets"
      );
    }

    // Find the specific ticket
    const ticketIndex = booking.individualQRs.findIndex(
      (qr) => qr.reference === qrData.ticketReference
    );

    if (ticketIndex === -1) {
      console.log("❌ Ticket not found. Available tickets:");
      booking.individualQRs.forEach((qr, index) => {
        console.log(`  ${index}: ${qr.reference} - ${qr.attendee.name}`);
      });
      return sendError(res, 400, "Invalid ticket reference");
    }

    const ticket = booking.individualQRs[ticketIndex];

    console.log("🎫 Ticket Found:");
    console.log("- Ticket Reference:", ticket.reference);
    console.log("- Attendee Name (stored):", ticket.attendee.name);
    console.log("- Attendee Name (QR):", qrData.attendeeName);
    console.log("- Is Already Used:", ticket.isUsed);

    // More flexible verification - check attendee name or email
    const nameMatches = qrData.attendeeName === ticket.attendee.name;
    const emailMatches = qrData.attendeeEmail === ticket.attendee.email;

    if (!nameMatches && !emailMatches) {
      return sendError(
        res,
        400,
        "QR code verification failed - Attendee information does not match"
      );
    }

    // Check booking status
    if (booking.status !== "confirmed") {
      return sendError(res, 400, "Only confirmed bookings can be verified");
    }

    // Check if this specific ticket is already used
    if (ticket.isUsed) {
      return sendError(res, 400, "This ticket has already been used", {
        usedAt: ticket.checkInTime,
        usedBy: ticket.checkedInBy,
      });
    }

    // Check if event has started (optional - you might want to allow early check-ins)
    const eventDate = new Date(booking.event.startDate);
    const now = new Date();
    const hoursUntilEvent = (eventDate - now) / (1000 * 60 * 60);

    // Allow check-in up to 24 hours before event starts (more flexible)
    if (hoursUntilEvent > 24) {
      return sendError(
        res,
        400,
        `Event check-in opens 24 hours before start time. Event starts in ${Math.ceil(
          hoursUntilEvent
        )} hours.`
      );
    }

    // Mark the individual ticket as used
    booking.individualQRs[ticketIndex].isUsed = true;
    booking.individualQRs[ticketIndex].checkInTime = new Date();
    booking.individualQRs[ticketIndex].checkedInBy = req.user._id;

    // Check if all tickets in this booking are now used
    const allTicketsUsed = booking.individualQRs.every((qr) => qr.isUsed);
    if (allTicketsUsed) {
      booking.isCheckedIn = true;
      booking.checkInTime = new Date();
      booking.checkedInBy = req.user._id;
      booking.status = "used";
    }

    await booking.save();

    // Send email notification to the user
    try {
      const checkedInBy = {
        firstName: req.user.firstName,
        lastName: req.user.lastName,
      };

      await sendTicketUsageNotification(
        booking.user,
        booking.individualQRs[ticketIndex],
        booking,
        booking.event,
        checkedInBy
      );

      console.log(`📧 Ticket usage notification sent to ${booking.user.email}`);
    } catch (emailError) {
      console.error("Failed to send ticket usage notification:", emailError);
      // Don't fail the check-in if email fails
    }

    // Return success response
    sendSuccess(
      res,
      "Ticket verified and checked in successfully! Email notification sent.",
      {
        ticket: {
          ticketNumber: ticket.ticketNumber,
          reference: ticket.reference,
          attendeeName: ticket.attendee.name,
          attendeeEmail: ticket.attendee.email,
          checkInTime: ticket.checkInTime,
          isUsed: ticket.isUsed,
          ticketType: booking.ticketType,
        },
        booking: {
          _id: booking._id,
          allTicketsUsed,
          totalTickets: booking.individualQRs.length,
          usedTickets: booking.individualQRs.filter((qr) => qr.isUsed).length,
        },
        event: {
          title: booking.event.title,
          startDate: booking.event.startDate,
          venue: booking.event.venue,
        },
      }
    );
  } catch (error) {
    console.error("Verify and use ticket error:", error);
    sendError(res, 500, "Failed to verify ticket", error.message);
  }
};

module.exports = {
  createBooking,
  getUserBookings,
  getBookingById,
  cancelBooking,
  checkInBooking,
  verifyQRCode,
  checkInIndividualTicket,
  registerForFreeEvent,
  debugBookingQRs,
  verifyAndUseTicket,
};
