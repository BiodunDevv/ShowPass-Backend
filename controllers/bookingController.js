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
  generateVerificationCodes,
  generateCodeHash,
  verifyCodeHash,
} = require("../utils/codeGenerator");
const {
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

    // Check if user is trying to book their own event (organizers cannot book their own events)
    if (event.organizer.toString() === req.user._id.toString()) {
      return sendError(
        res,
        403,
        "Event organizers cannot book tickets for their own events"
      );
    }

    // Only regular users can book events (not organizers or admins)
    if (req.user.role !== "user") {
      return sendError(
        res,
        403,
        "Only regular users can book event tickets. Organizers and admins cannot book tickets."
      );
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

    // Generate verification codes immediately since payment is already processed
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

    // Create booking first (without verification codes)
    const booking = new Booking({
      ...bookingData,
      attendeeInfo: attendeeList,
    });

    await booking.save();

    // Manual populate for flexible user types (RegularUser, Organizer, Admin)
    const UserManager = require("../utils/UserManager");
    const userResult = await UserManager.findById(booking.user);
    let populatedUser = null;
    if (userResult) {
      populatedUser = userResult.user;
    }

    await booking.populate([
      { path: "event", select: "title startDate endDate venue organizer" },
    ]);

    // Debug the populated user data
    console.log("🔍 Booking Creation User Debug:", {
      hasUserResult: !!userResult,
      hasPopulatedUser: !!populatedUser,
      userEmail: populatedUser?.email,
      userFirstName: populatedUser?.firstName,
      userLastName: populatedUser?.lastName,
      userRole: userResult?.role,
      userKeys: populatedUser
        ? Object.keys(
            populatedUser.toObject ? populatedUser.toObject() : populatedUser
          )
        : [],
      bookingUserId: booking.user,
    });

    // Generate individual verification codes for each attendee
    const verificationCodes = generateVerificationCodes(quantity);
    const individualCodes = verificationCodes.map((code, index) => ({
      code: code,
      ticketNumber: index + 1,
      attendee: attendeeList[index] || attendeeList[0],
      hash: generateCodeHash(booking, code),
      isUsed: false,
    }));

    // Save individual verification codes to the booking
    booking.verificationCodes = individualCodes;
    booking.markModified("verificationCodes"); // Ensure MongoDB knows the field changed
    await booking.save();

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
      }
    } catch (spendingError) {
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

    // Send individual ticket emails with verification codes
    try {
      console.log("🔄 Attempting to send booking confirmation emails...");
      console.log("📋 Email data check:", {
        hasPopulatedUser: !!populatedUser,
        populatedUserEmail: populatedUser?.email,
        populatedUserName: populatedUser?.firstName,
        eventTitle: event?.title,
        verificationCodesCount: individualCodes?.length,
        reqUserEmail: req.user?.email,
        reqUserName: req.user?.firstName,
      });

      // Use populatedUser if available, otherwise fall back to req.user
      const emailUser = populatedUser || req.user;
      await sendIndividualTicketsAndConfirmation(
        emailUser,
        booking,
        event,
        individualCodes
      );
      console.log("✅ Booking confirmation emails sent successfully");
    } catch (emailError) {
      // Email failure shouldn't fail the booking
      console.error(
        "❌ Failed to send booking confirmation emails:",
        emailError
      );
      console.error("Email error details:", {
        populatedUserEmail: populatedUser?.email,
        reqUserEmail: req.user?.email,
        eventTitle: event?.title,
        verificationCodesCount: individualCodes?.length,
        error: emailError.message,
        stack: emailError.stack,
      });
    }

    sendSuccess(
      res,
      "Booking completed successfully! Check your email for ticket details.",
      booking
    );
  } catch (error) {
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
    sendError(res, 500, "Failed to retrieve booking", error.message);
  }
};

// Update booking
const updateBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findById(id);

    if (!booking) {
      return sendError(res, 404, "Booking not found");
    }

    // Check if user owns the booking
    if (booking.user.toString() !== req.user._id.toString()) {
      return sendError(res, 403, "You can only update your own bookings");
    }

    if (booking.status !== "confirmed") {
      return sendError(res, 400, "Only confirmed bookings can be updated");
    }

    // Only allow updating certain fields
    const allowedUpdates = ["attendeeInfo"];
    const updates = {};
    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    Object.assign(booking, updates);
    await booking.save();

    sendSuccess(res, "Booking updated successfully", booking);
  } catch (error) {
    sendError(res, 500, "Failed to update booking", error.message);
  }
};

// Delete booking (admin only)
const deleteBooking = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== "admin") {
      return sendError(res, 403, "Only admins can delete bookings");
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      return sendError(res, 404, "Booking not found");
    }

    await Booking.findByIdAndDelete(id);
    sendSuccess(res, "Booking deleted successfully");
  } catch (error) {
    sendError(res, 500, "Failed to delete booking", error.message);
  }
};

// Get all bookings (admin only)
const getAllBookings = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return sendError(res, 403, "Only admins can view all bookings");
    }

    const { page, limit, skip } = getPagination(req);
    const { status, event } = req.query;

    let query = {};
    if (status) query.status = status;
    if (event) query.event = event;

    const bookings = await Booking.find(query)
      .populate("user", "firstName lastName email")
      .populate("event", "title startDate venue organizer")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Booking.countDocuments(query);

    sendSuccess(res, "All bookings retrieved successfully", bookings, {
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    sendError(res, 500, "Failed to retrieve bookings", error.message);
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

    // Check if user is the specific organizer of this event (not just any organizer)
    const isEventOrganizer =
      booking.event.organizer.toString() === req.user._id.toString();

    if (!isEventOrganizer) {
      return sendError(
        res,
        403,
        "Only the organizer of this specific event can check-in attendees"
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
    sendError(res, 500, "Failed to check-in booking", error.message);
  }
};

// Legacy function - use verifyEventTicket instead
const verifyQRCode = async (req, res) => {
  console.warn(
    "⚠️ verifyQRCode endpoint is deprecated. Use verifyEventTicket instead."
  );
  return sendError(
    res,
    410,
    "This endpoint is deprecated. Please use /verify-event with verification codes instead."
  );
};

// Legacy function - use verifyEventTicket instead
const checkInIndividualTicket = async (req, res) => {
  return sendError(
    res,
    410,
    "This endpoint is deprecated. Please use /verify-event with verification codes instead."
  );
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

    // Check if user is trying to register for their own event (organizers cannot register for their own events)
    if (event.organizer.toString() === req.user._id.toString()) {
      return sendError(
        res,
        403,
        "Event organizers cannot register for their own events"
      );
    }

    // Only regular users can register for events (not organizers or admins)
    if (req.user.role !== "user") {
      return sendError(
        res,
        403,
        "Only regular users can register for events. Organizers and admins cannot register."
      );
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

    // Create booking for free event
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

    // Generate individual verification codes for each attendee
    const verificationCodes = generateVerificationCodes(quantity);
    const individualCodes = verificationCodes.map((code, index) => ({
      code: code,
      ticketNumber: index + 1,
      attendee: attendeeList[index] || attendeeList[0],
      hash: generateCodeHash(booking, code),
      isUsed: false,
    }));

    // Save individual verification codes to the booking
    booking.verificationCodes = individualCodes;
    booking.markModified("verificationCodes"); // Ensure MongoDB knows the field changed
    await booking.save();

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
        individualCodes
      );
    } catch (emailError) {
      // Email failure shouldn't fail the booking
    }

    sendSuccess(
      res,
      "Successfully registered for free event! Your tickets have been confirmed.",
      booking
    );
  } catch (error) {
    sendError(res, 500, "Failed to register for free event", error.message);
  }
};

// Verify event with 10-digit code and mark ticket as used
const verifyEventTicket = async (req, res) => {
  try {
    const { eventId, verificationCode } = req.body;

    if (!eventId || !verificationCode) {
      return sendError(res, 400, "Event ID and verification code are required");
    }

    // Validate verification code format (10 digits)
    if (!/^\d{10}$/.test(verificationCode)) {
      return sendError(
        res,
        400,
        "Invalid verification code format. Must be 10 digits."
      );
    }

    // Find the booking with this verification code for this event
    const booking = await Booking.findOne({
      event: eventId,
      "verificationCodes.code": verificationCode,
    }).populate("event", "title organizer startDate endDate venue");

    if (!booking) {
      return sendError(res, 404, "Invalid verification code or event");
    }

    // Manual populate for flexible user types (RegularUser, Organizer, Admin)
    const UserManager = require("../utils/UserManager");
    const userResult = await UserManager.findById(booking.user);
    let populatedUser = null;
    if (userResult) {
      populatedUser = userResult.user;
    }

    // Validate that we have complete user data
    if (!populatedUser || !booking.event) {
      return sendError(
        res,
        500,
        "Booking data is incomplete - missing user or event information"
      );
    }

    // Check if user is the specific organizer of this event (not just any organizer)
    const isEventOrganizer =
      booking.event.organizer.toString() === req.user._id.toString();

    if (!isEventOrganizer) {
      return sendError(
        res,
        403,
        "Only the organizer of this specific event can verify tickets"
      );
    }

    // Find the specific verification code
    const codeIndex = booking.verificationCodes.findIndex(
      (code) => code.code === verificationCode
    );

    if (codeIndex === -1) {
      return sendError(res, 400, "Verification code not found");
    }

    const ticketCode = booking.verificationCodes[codeIndex];

    // Check booking status
    if (booking.status !== "confirmed") {
      return sendError(res, 400, "Only confirmed bookings can be verified");
    }

    // Check if this specific ticket code is already used
    if (ticketCode.isUsed) {
      return sendError(
        res,
        400,
        "This verification code has already been used",
        {
          usedAt: ticketCode.checkInTime,
          usedBy: ticketCode.checkedInBy,
          attendee: ticketCode.attendee.name,
        }
      );
    }

    // Check if event has started (optional - allow early check-ins)
    const eventDate = new Date(booking.event.startDate);
    const now = new Date();
    const hoursUntilEvent = (eventDate - now) / (1000 * 60 * 60);

    // Allow check-in up to 24 hours before event starts
    // if (hoursUntilEvent > 24) {
    //   return sendError(
    //     res,
    //     400,
    //     `Event check-in opens 24 hours before start time. Event starts in ${Math.ceil(
    //       hoursUntilEvent
    //     )} hours.`
    //   );
    // }

    // Verify the code hash for security
    const isValidHash = verifyCodeHash(
      booking,
      verificationCode,
      ticketCode.hash
    );
    if (!isValidHash) {
      return sendError(
        res,
        400,
        "Invalid verification code - security check failed"
      );
    }

    // Mark the verification code as used
    booking.verificationCodes[codeIndex].isUsed = true;
    booking.verificationCodes[codeIndex].checkInTime = new Date();
    booking.verificationCodes[codeIndex].checkedInBy = req.user._id;

    // Check if all verification codes in this booking are now used
    const allCodesUsed = booking.verificationCodes.every((code) => code.isUsed);
    if (allCodesUsed) {
      booking.status = "used";
      booking.isCheckedIn = true;
      booking.checkInTime = new Date();
      booking.checkedInBy = req.user._id;
    }

    // Save the booking
    await booking.save();

    // Send email notification to the specific attendee whose ticket was used
    try {
      if (
        ticketCode.attendee &&
        ticketCode.attendee.email &&
        ticketCode.attendee.name
      ) {
        // Create attendee user object for email service
        const attendeeUser = {
          email: ticketCode.attendee.email,
          firstName: ticketCode.attendee.name.split(" ")[0], // Extract first name
          lastName:
            ticketCode.attendee.name.split(" ").slice(1).join(" ") || "", // Extract last name
          phone: ticketCode.attendee.phone || "",
        };

        await sendTicketUsageNotification(
          attendeeUser,
          booking.event,
          ticketCode,
          req.user // Pass the full user object instead of just req.user._id
        );
        console.log(
          "✅ Ticket usage notification sent successfully to attendee:",
          ticketCode.attendee.email
        );
      } else {
        console.log(
          "⚠️ Skipping email notification - attendee data incomplete:",
          {
            hasAttendee: !!ticketCode.attendee,
            hasEmail: !!ticketCode.attendee?.email,
            hasName: !!ticketCode.attendee?.name,
            attendeeEmail: ticketCode.attendee?.email,
            attendeeName: ticketCode.attendee?.name,
          }
        );
      }
    } catch (emailError) {
      // Don't fail the verification for email errors
      console.error("❌ Email notification failed:", emailError.message);
    }

    // Return success with full event and booking details
    sendSuccess(
      res,
      "Verification code verified successfully! Attendee checked in.",
      {
        booking: {
          id: booking._id,
          paymentReference: booking.paymentReference,
          status: booking.status,
          totalAmount: booking.totalAmount,
          finalAmount: booking.finalAmount,
          ticketType: booking.ticketType,
          quantity: booking.quantity,
          checkInTime: ticketCode.checkInTime,
          allCodesUsed: allCodesUsed,
        },
        event: {
          id: booking.event._id,
          title: booking.event.title,
          startDate: booking.event.startDate,
          endDate: booking.event.endDate,
          venue: booking.event.venue,
        },
        attendee: {
          name: ticketCode.attendee.name,
          email: ticketCode.attendee.email,
          phone: ticketCode.attendee.phone,
          ticketNumber: ticketCode.ticketNumber,
        },
        user: {
          id: populatedUser._id,
          name: `${populatedUser.firstName} ${populatedUser.lastName}`,
          email: populatedUser.email,
          phone: populatedUser.phone,
        },
        verification: {
          code: verificationCode,
          usedAt: ticketCode.checkInTime,
          verifiedBy: req.user._id,
        },
      }
    );
  } catch (error) {
    sendError(res, 500, "Failed to verify event ticket", error.message);
  }
};

// Confirm booking payment and generate verification codes
const confirmBookingPayment = async (req, res) => {
  try {
    const { bookingId, paymentReference, paystackReference } = req.body;

    const booking = await Booking.findById(bookingId)
      .populate("user", "firstName lastName email phone")
      .populate("event", "title startDate endDate venue organizer");

    if (!booking) {
      return sendError(res, 404, "Booking not found");
    }

    if (booking.status === "confirmed") {
      return sendError(res, 400, "Booking already confirmed");
    }

    // Update booking status and payment details
    booking.status = "confirmed";
    booking.paymentStatus = "paid";
    booking.paymentReference = paymentReference;
    booking.paystackReference = paystackReference;
    booking.confirmedAt = new Date();

    // Generate verification codes if not already generated
    if (!booking.verificationCodes || booking.verificationCodes.length === 0) {
      const verificationCodes = generateVerificationCodes(booking.quantity);
      const individualCodes = verificationCodes.map((code, index) => ({
        code: code,
        ticketNumber: index + 1,
        attendee: booking.attendeeInfo[index] || booking.attendeeInfo[0],
        hash: generateCodeHash(booking, code),
        isUsed: false,
      }));

      booking.verificationCodes = individualCodes;
      booking.markModified("verificationCodes");
    }

    await booking.save();

    // Update user's attending events array
    await updateUserEventArrays(
      booking.user._id,
      booking.event._id,
      "attending"
    );

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

    // Send email with verification codes
    try {
      console.log("🔄 Attempting to send payment confirmation emails...");
      console.log("📋 Payment confirmation email data:", {
        hasBookingUser: !!booking.user,
        bookingUserEmail: booking.user?.email,
        bookingUserName: booking.user?.firstName,
        eventTitle: booking.event?.title,
        verificationCodesCount: booking.verificationCodes?.length,
        bookingId: booking._id,
      });

      await sendIndividualTicketsAndConfirmation(
        booking.user,
        booking,
        booking.event,
        booking.verificationCodes
      );
      console.log("✅ Payment confirmation emails sent successfully");
    } catch (emailError) {
      // Email failure shouldn't fail the confirmation
      console.error(
        "❌ Failed to send payment confirmation emails:",
        emailError
      );
      console.error("Email error details:", {
        userEmail: booking.user?.email,
        eventTitle: booking.event?.title,
        verificationCodesCount: booking.verificationCodes?.length,
        error: emailError.message,
        stack: emailError.stack,
      });
    }

    if (res && res.json) {
      sendSuccess(
        res,
        "Booking confirmed successfully! Check your email for tickets.",
        booking
      );
    } else {
      // Called from webhook - just log success
      console.log(`✅ Booking ${bookingId} confirmed with verification codes`);
    }
  } catch (error) {
    console.error("Confirm booking payment error:", error);
    if (res && res.json) {
      sendError(res, 500, "Failed to confirm booking", error.message);
    }
  }
};

module.exports = {
  createBooking,
  getUserBookings,
  getBookingById,
  updateBooking,
  deleteBooking,
  getAllBookings,
  cancelBooking,
  checkInBooking,
  verifyQRCode,
  checkInIndividualTicket,
  registerForFreeEvent,
  verifyEventTicket,
  confirmBookingPayment,
};
