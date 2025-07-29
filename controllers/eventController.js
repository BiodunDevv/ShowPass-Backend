const Event = require("../models/Event");
const UserManager = require("../utils/UserManager");
const Booking = require("../models/Booking");
const {
  sendSuccess,
  sendError,
  getPagination,
  updateUserEventArrays,
  checkEventIsFree,
  validateFreeEventTickets,
} = require("../utils/helpers");
const {
  sendEventCreationNotification,
  sendAdminEventNotification,
  sendEventUpdateNotification,
  sendOrganizerEventUpdateNotification,
  sendAdminEventUpdateNotification,
  sendOrganizerWarningNotification,
  sendEventDeletionNotification,
} = require("../utils/emailService");

// Create new event
const createEvent = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      venue,
      startDate,
      endDate,
      startTime,
      endTime,
      ticketTypes,
      images,
      tags,
      maxAttendees,
      isPublic = true,
    } = req.body;

    // Validate that user is organizer or admin
    if (req.user.role === "user") {
      return sendError(
        res,
        403,
        "Only organizers and admins can create events"
      );
    }

    // Validate ticket types for free events
    const ticketValidation = validateFreeEventTickets(ticketTypes);
    if (!ticketValidation.isValid) {
      return sendError(
        res,
        400,
        "Ticket validation failed",
        ticketValidation.errors
      );
    }

    // Check if event is free
    const isFreeEvent = checkEventIsFree(ticketTypes);

    const event = new Event({
      title,
      description,
      organizer: req.user._id,
      category,
      venue,
      startDate,
      endDate,
      startTime,
      endTime,
      ticketTypes,
      images: images || [],
      tags: tags || [],
      maxAttendees,
      isPublic,
      isFreeEvent,
    });

    await event.save();

    // Update organizer's created events array
    await updateUserEventArrays(req.user._id, event._id, "created");

    // Send notification to organizer
    try {
      await sendEventCreationNotification(req.user, event);
      console.log(
        `📧 Event creation notification sent to organizer: ${req.user.email}`
      );
    } catch (emailError) {
      console.error("Failed to send organizer notification:", emailError);
    }

    // Send notification to all admins
    try {
      const admins = await UserManager.getAllAdmins();
      for (const admin of admins) {
        await sendAdminEventNotification(admin, event, req.user);
        console.log(`📧 Admin notification sent to: ${admin.email}`);
      }
    } catch (emailError) {
      console.error("Failed to send admin notifications:", emailError);
    }

    // Get fresh event data with populated organizer for response
    const createdEvent = await Event.findById(event._id).populate(
      "organizer",
      "firstName lastName email"
    );

    sendSuccess(
      res,
      `Event created successfully! ${
        isFreeEvent ? "Your free event" : "Your event"
      } will be visible to users after admin approval.`,
      createdEvent
    );
  } catch (error) {
    console.error("Create event error:", error);
    sendError(res, 500, "Failed to create event", error.message);
  }
};

// Get all public events (with filtering and pagination)
const getEvents = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req);
    const {
      category,
      city,
      state,
      startDate,
      endDate,
      search,
      sortBy = "startDate",
      sortOrder = "asc",
      featured,
    } = req.query;

    // Build query
    let query = {
      approved: true,
      isPublic: true,
      status: "approved",
    };

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Filter by location
    if (city) {
      query["venue.city"] = new RegExp(city, "i");
    }
    if (state) {
      query["venue.state"] = new RegExp(state, "i");
    }

    // Filter by date range
    if (startDate || endDate) {
      query.startDate = {};
      if (startDate) {
        query.startDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.startDate.$lte = new Date(endDate);
      }
    }

    // Search in title and description
    if (search) {
      query.$or = [
        { title: new RegExp(search, "i") },
        { description: new RegExp(search, "i") },
        { tags: { $in: [new RegExp(search, "i")] } },
      ];
    }

    // Filter featured events
    if (featured === "true") {
      query.featured = true;
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    const events = await Event.find(query)
      .populate("organizer", "firstName lastName email")
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Event.countDocuments(query);

    sendSuccess(res, "Events retrieved successfully", events, {
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get events error:", error);
    sendError(res, 500, "Failed to retrieve events", error.message);
  }
};

// Get single event by ID
const getEventById = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id).populate(
      "organizer",
      "firstName lastName email phone"
    );

    if (!event) {
      return sendError(res, 404, "Event not found");
    }

    // Only show approved events to regular users
    if (
      !event.approved &&
      req.user?.role !== "admin" &&
      event.organizer._id.toString() !== req.user?._id.toString()
    ) {
      return sendError(res, 404, "Event not found");
    }

    sendSuccess(res, "Event retrieved successfully", event);
  } catch (error) {
    console.error("Get event error:", error);
    sendError(res, 500, "Failed to retrieve event", error.message);
  }
};

// Update event (organizer only)
const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const event = await Event.findById(id);
    if (!event) {
      return sendError(res, 404, "Event not found");
    }

    // Check if user owns the event or is admin
    if (
      event.organizer.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return sendError(res, 403, "You can only update your own events");
    }

    // Don't allow updating certain fields after approval
    if (event.approved && updates.ticketTypes) {
      return sendError(
        res,
        400,
        "Cannot modify ticket types after event is approved"
      );
    }

    // Update event
    Object.keys(updates).forEach((key) => {
      if (updates[key] !== undefined) {
        event[key] = updates[key];
      }
    });

    // Define major change fields first
    const majorChangeFields = ["startDate", "endDate", "venue", "ticketTypes"];

    // Generate change details for all notifications
    let changeDetails = generateChangeDetails(updates, majorChangeFields);

    // If major changes are made, reset approval status
    const hasMajorChanges = majorChangeFields.some(
      (field) => updates[field] !== undefined
    );

    // Track post-approval modifications
    if (event.approved && Object.keys(updates).length > 0) {
      event.postApprovalModifications.push({
        modifiedAt: new Date(),
        modifiedBy: req.user._id,
        changes: updates,
        reviewedByAdmin: false,
      });
    }

    if (hasMajorChanges && event.approved) {
      event.approved = false;
      event.status = "pending";

      // Notify all attendees about major changes
      try {
        // Get all confirmed bookings for this event
        const bookings = await Booking.find({
          event: event._id,
          status: "confirmed",
        }).populate("user", "firstName lastName email");

        if (bookings.length > 0) {
          // Use the change details message already generated
          // Send notifications to all attendees
          for (const booking of bookings) {
            try {
              await sendEventUpdateNotification(
                booking.user,
                event,
                changeDetails
              );
            } catch (emailError) {
              console.error(
                `Failed to send update notification to ${booking.user.email}:`,
                emailError
              );
            }
          }

          console.log(
            `📧 Event update notifications sent to ${bookings.length} attendees`
          );
        }
      } catch (notificationError) {
        console.error(
          "Failed to send event update notifications:",
          notificationError
        );
      }
    } else if (Object.keys(updates).length > 0 && event.approved) {
      // For minor changes, still notify attendees but don't reset approval
      try {
        // Check if there are any meaningful changes to notify about
        const notifiableFields = [
          "title",
          "description",
          "startTime",
          "endTime",
          "category",
        ];
        const hasNotifiableChanges = notifiableFields.some(
          (field) => updates[field] !== undefined
        );

        if (hasNotifiableChanges) {
          // Get all confirmed bookings for this event
          const bookings = await Booking.find({
            event: event._id,
            status: "confirmed",
          }).populate("user", "firstName lastName email");

          if (bookings.length > 0) {
            // Use the change details message already generated for minor changes
            // Send notifications to all attendees
            for (const booking of bookings) {
              try {
                await sendEventUpdateNotification(
                  booking.user,
                  event,
                  changeDetails
                );
              } catch (emailError) {
                console.error(
                  `Failed to send minor update notification to ${booking.user.email}:`,
                  emailError
                );
              }
            }

            console.log(
              `📧 Minor event update notifications sent to ${bookings.length} attendees`
            );
          }
        }
      } catch (notificationError) {
        console.error(
          "Failed to send minor event update notifications:",
          notificationError
        );
      }
    }

    await event.save();

    // Populate organizer details before sending notifications and response
    await event.populate("organizer", "firstName lastName email");

    // Send organizer notification for event update (regardless of approval status)
    try {
      await sendOrganizerEventUpdateNotification(
        event.organizer,
        event,
        changeDetails
      );
      console.log(
        `📧 Organizer update notification sent to: ${event.organizer.email}`
      );
    } catch (orgNotificationError) {
      console.error(
        "Failed to send organizer update notification:",
        orgNotificationError
      );
    }

    // Send admin notifications for event update (regardless of approval status)
    try {
      const admins = await UserManager.getAllAdmins();
      for (const admin of admins) {
        await sendAdminEventUpdateNotification(
          admin,
          event,
          event.organizer,
          changeDetails
        );
        console.log(`📧 Admin update notification sent to: ${admin.email}`);
      }
    } catch (adminNotificationError) {
      console.error(
        "Failed to send admin update notifications:",
        adminNotificationError
      );
    }

    // Ensure the response includes populated organizer data
    const updatedEvent = await Event.findById(event._id).populate(
      "organizer",
      "firstName lastName email"
    );
    sendSuccess(res, "Event updated successfully", updatedEvent);
  } catch (error) {
    console.error("Update event error:", error);
    sendError(res, 500, "Failed to update event", error.message);
  }
};

// Delete event (organizer only)
const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id);
    if (!event) {
      return sendError(res, 404, "Event not found");
    }

    // Check if user owns the event or is admin
    if (
      event.organizer.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return sendError(res, 403, "You can only delete your own events");
    }

    // Check if event has bookings
    const bookingsCount = await Booking.countDocuments({
      event: id,
      status: "confirmed",
    });
    if (bookingsCount > 0) {
      return sendError(
        res,
        400,
        "Cannot delete event with confirmed bookings. Please cancel the event instead."
      );
    }

    await Event.findByIdAndDelete(id);

    sendSuccess(res, "Event deleted successfully");
  } catch (error) {
    console.error("Delete event error:", error);
    sendError(res, 500, "Failed to delete event", error.message);
  }
};

// Get organizer's events
const getOrganizerEvents = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req);
    const { status } = req.query;

    let query = { organizer: req.user._id };

    if (status) {
      query.status = status;
    }

    const events = await Event.find(query)
      .populate("organizer", "firstName lastName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Event.countDocuments(query);

    sendSuccess(res, "Organizer events retrieved successfully", events, {
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get organizer events error:", error);
    sendError(res, 500, "Failed to retrieve organizer events", error.message);
  }
};

// Get event attendees (organizer only)
const getEventAttendees = async (req, res) => {
  try {
    const { id } = req.params;
    const { page, limit, skip } = getPagination(req);

    const event = await Event.findById(id);
    if (!event) {
      return sendError(res, 404, "Event not found");
    }

    // Check if user owns the event or is admin
    if (
      event.organizer.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return sendError(
        res,
        403,
        "You can only view attendees for your own events"
      );
    }

    const bookings = await Booking.find({
      event: id,
      status: "confirmed",
    })
      .populate("user", "firstName lastName email phone")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Booking.countDocuments({
      event: id,
      status: "confirmed",
    });

    sendSuccess(res, "Event attendees retrieved successfully", bookings, {
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get event attendees error:", error);
    sendError(res, 500, "Failed to retrieve event attendees", error.message);
  }
};

// Get event categories
const getEventCategories = async (req, res) => {
  try {
    const categories = [
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
    ];

    sendSuccess(res, "Event categories retrieved successfully", categories);
  } catch (error) {
    console.error("Get categories error:", error);
    sendError(res, 500, "Failed to retrieve categories", error.message);
  }
};

// Admin: Issue warning to organizer for inappropriate event updates
const issueOrganizerWarning = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return sendError(res, 403, "Admin access required");
    }

    const { eventId } = req.params;
    const { reason, severity = "minor" } = req.body;

    if (!reason) {
      return sendError(res, 400, "Warning reason is required");
    }

    const event = await Event.findById(eventId).populate(
      "organizer",
      "firstName lastName email"
    );

    if (!event) {
      return sendError(res, 404, "Event not found");
    }

    // Add warning to event
    const warning = {
      adminId: req.user._id,
      reason,
      severity,
      issuedAt: new Date(),
    };

    event.warnings.push(warning);
    event.warningCount += 1;

    // Flag for deletion if critical warning or multiple warnings
    if (severity === "critical" || event.warningCount >= 3) {
      event.flaggedForDeletion = true;
      event.flaggedBy = req.user._id;
      event.flaggedAt = new Date();
      event.deletionReason = `${
        severity === "critical" ? "Critical violation" : "Multiple warnings"
      }: ${reason}`;
    }

    await event.save();

    // Send warning email to organizer
    try {
      await sendOrganizerWarningNotification(event.organizer, event, warning);
      console.log(
        `📧 Warning notification sent to organizer: ${event.organizer.email}`
      );
    } catch (emailError) {
      console.error("Failed to send warning notification:", emailError);
    }

    sendSuccess(
      res,
      `Warning issued successfully. ${
        event.flaggedForDeletion ? "Event has been flagged for deletion." : ""
      }`,
      {
        warningCount: event.warningCount,
        flaggedForDeletion: event.flaggedForDeletion,
        warning,
      }
    );
  } catch (error) {
    console.error("Issue warning error:", error);
    sendError(res, 500, "Failed to issue warning", error.message);
  }
};

// Admin: Delete flagged event
const deleteEventByAdmin = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return sendError(res, 403, "Admin access required");
    }

    const { eventId } = req.params;
    const { reason } = req.body;

    const event = await Event.findById(eventId).populate(
      "organizer",
      "firstName lastName email"
    );

    if (!event) {
      return sendError(res, 404, "Event not found");
    }

    // Check if event has bookings
    const bookingsCount = await Booking.countDocuments({
      event: eventId,
      status: "confirmed",
    });

    if (bookingsCount > 0) {
      return sendError(
        res,
        400,
        "Cannot delete event with confirmed bookings. Please process refunds first."
      );
    }

    // Send notification to organizer about deletion
    try {
      await sendEventDeletionNotification(
        event.organizer,
        event,
        reason || event.deletionReason || "Administrative action"
      );
      console.log(
        `📧 Event deletion notification sent to organizer: ${event.organizer.email}`
      );
    } catch (emailError) {
      console.error("Failed to send deletion notification:", emailError);
    }

    await Event.findByIdAndDelete(eventId);

    sendSuccess(res, "Event deleted successfully by admin", {
      eventTitle: event.title,
      organizerEmail: event.organizer.email,
      reason: reason || event.deletionReason,
    });
  } catch (error) {
    console.error("Admin delete event error:", error);
    sendError(res, 500, "Failed to delete event", error.message);
  }
};

// Admin: Get events requiring review (flagged or with unreviewed post-approval modifications)
const getEventsForReview = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return sendError(res, 403, "Admin access required");
    }

    const { page, limit, skip } = getPagination(req);

    // Find events that need admin review
    const query = {
      $or: [
        { flaggedForDeletion: true },
        { warningCount: { $gt: 0 } },
        {
          "postApprovalModifications.reviewedByAdmin": false,
          approved: true,
        },
      ],
    };

    const events = await Event.find(query)
      .populate("organizer", "firstName lastName email")
      .populate("flaggedBy", "firstName lastName")
      .populate("warnings.adminId", "firstName lastName")
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Event.countDocuments(query);

    const eventsWithReviewInfo = events.map((event) => ({
      ...event.toObject(),
      reviewFlags: {
        flaggedForDeletion: event.flaggedForDeletion,
        warningCount: event.warningCount,
        unreviewed_modifications: event.postApprovalModifications.filter(
          (mod) => !mod.reviewedByAdmin
        ).length,
        lastModified: event.updatedAt,
      },
    }));

    sendSuccess(
      res,
      "Events for review retrieved successfully",
      eventsWithReviewInfo,
      {
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      }
    );
  } catch (error) {
    console.error("Get events for review error:", error);
    sendError(res, 500, "Failed to retrieve events for review", error.message);
  }
};

// Admin: Review post-approval modification
const reviewPostApprovalModification = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return sendError(res, 403, "Admin access required");
    }

    const { eventId, modificationId } = req.params;
    const { approved, feedback } = req.body;

    const event = await Event.findById(eventId);
    if (!event) {
      return sendError(res, 404, "Event not found");
    }

    const modification = event.postApprovalModifications.id(modificationId);
    if (!modification) {
      return sendError(res, 404, "Modification not found");
    }

    modification.reviewedByAdmin = true;
    modification.reviewedAt = new Date();
    modification.reviewedBy = req.user._id;
    modification.approved = approved;

    await event.save();

    // If not approved, could trigger a warning
    if (!approved) {
      // Optionally auto-issue a warning for rejected modifications
      const warning = {
        adminId: req.user._id,
        reason: `Post-approval modification rejected: ${
          feedback || "Inappropriate changes"
        }`,
        severity: "major",
        issuedAt: new Date(),
      };

      event.warnings.push(warning);
      event.warningCount += 1;

      if (event.warningCount >= 3) {
        event.flaggedForDeletion = true;
        event.flaggedBy = req.user._id;
        event.flaggedAt = new Date();
        event.deletionReason = `Multiple violations: Latest - ${feedback}`;
      }

      await event.save();
    }

    sendSuccess(res, "Modification reviewed successfully", {
      approved,
      warningIssued: !approved,
      flaggedForDeletion: event.flaggedForDeletion,
    });
  } catch (error) {
    console.error("Review modification error:", error);
    sendError(res, 500, "Failed to review modification", error.message);
  }
};

// Get user's created events (for organizers)
const getUserCreatedEvents = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req);

    const user = await UserManager.findById(req.user._id);

    if (!user) {
      return sendError(res, 404, "User not found");
    }

    // Get user's created events with pagination and populate organizer
    const events = await Event.find({ organizer: req.user._id })
      .populate("organizer", "firstName lastName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Event.countDocuments({ organizer: req.user._id });

    sendSuccess(res, "Created events retrieved successfully", events, {
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get user created events error:", error);
    sendError(res, 500, "Failed to retrieve created events", error.message);
  }
};

// Get user's approved events (for admins)
const getUserApprovedEvents = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req);

    if (req.user.role !== "admin") {
      return sendError(res, 403, "Only admins can access approved events");
    }

    const user = await UserManager.findById(req.user._id);

    if (!user) {
      return sendError(res, 404, "User not found");
    }

    // Get approved events with pagination and populate organizer
    const events = await Event.find({ approved: true })
      .populate("organizer", "firstName lastName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Event.countDocuments({ approved: true });

    sendSuccess(res, "Approved events retrieved successfully", events, {
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get user approved events error:", error);
    sendError(res, 500, "Failed to retrieve approved events", error.message);
  }
};

// Get user's attending events
const getUserAttendingEvents = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req);

    const user = await UserManager.findById(req.user._id);

    if (!user) {
      return sendError(res, 404, "User not found");
    }

    // Get user's attending events through bookings with populated event organizer
    const Booking = require("../models/Booking");
    const bookings = await Booking.find({
      user: req.user._id,
      status: "confirmed",
    })
      .populate({
        path: "event",
        populate: {
          path: "organizer",
          select: "firstName lastName email",
        },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const events = bookings.map((booking) => booking.event);
    const total = await Booking.countDocuments({
      user: req.user._id,
      status: "confirmed",
    });

    sendSuccess(res, "Attending events retrieved successfully", events, {
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get user attending events error:", error);
    sendError(res, 500, "Failed to retrieve attending events", error.message);
  }
};

// Get free events
const getFreeEvents = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req);
    const {
      category,
      city,
      state,
      startDate,
      endDate,
      search,
      sortBy = "startDate",
      sortOrder = "asc",
    } = req.query;

    // Build query for free events
    let query = {
      approved: true,
      isPublic: true,
      status: "approved",
      isFreeEvent: true,
    };

    // Apply filters
    if (category) {
      query.category = category;
    }

    if (city) {
      query["venue.city"] = new RegExp(city, "i");
    }
    if (state) {
      query["venue.state"] = new RegExp(state, "i");
    }

    // Date range filter
    if (startDate || endDate) {
      query.startDate = {};
      if (startDate) {
        query.startDate.$gte = new Date(startDate);
      }
      if (endDate) {
        query.startDate.$lte = new Date(endDate);
      }
    }

    // Search filter
    if (search) {
      query.$or = [
        { title: new RegExp(search, "i") },
        { description: new RegExp(search, "i") },
        { tags: { $in: [new RegExp(search, "i")] } },
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    const events = await Event.find(query)
      .populate("organizer", "firstName lastName email")
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Event.countDocuments(query);

    sendSuccess(res, "Free events retrieved successfully", events, {
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get free events error:", error);
    sendError(res, 500, "Failed to retrieve free events", error.message);
  }
};

// Helper function to generate change details message
const generateChangeDetails = (updates, majorChangeFields) => {
  const changes = [];

  if (updates.startDate || updates.endDate) {
    if (updates.startDate) {
      changes.push(
        `📅 Event date changed to ${new Date(
          updates.startDate
        ).toLocaleDateString()}`
      );
    }
    if (updates.endDate) {
      changes.push(
        `📅 Event end date changed to ${new Date(
          updates.endDate
        ).toLocaleDateString()}`
      );
    }
  }

  if (updates.startTime || updates.endTime) {
    if (updates.startTime) {
      changes.push(`🕐 Start time changed to ${updates.startTime}`);
    }
    if (updates.endTime) {
      changes.push(`🕐 End time changed to ${updates.endTime}`);
    }
  }

  if (updates.venue) {
    if (updates.venue.name) {
      changes.push(`📍 Venue changed to ${updates.venue.name}`);
    }
    if (updates.venue.address) {
      changes.push(`🗺️ Address changed to ${updates.venue.address}`);
    }
    if (updates.venue.city) {
      changes.push(`🏙️ City changed to ${updates.venue.city}`);
    }
  }

  if (updates.ticketTypes) {
    changes.push(`🎟️ Ticket types and pricing have been updated`);
  }

  if (updates.title) {
    changes.push(`📝 Event title changed to "${updates.title}"`);
  }

  if (updates.description) {
    changes.push(`📄 Event description has been updated`);
  }

  if (updates.category) {
    changes.push(`🏷️ Event category changed to ${updates.category}`);
  }

  return changes.length > 0
    ? changes.join("<br/>")
    : "Event details have been updated. Please review the current information above.";
};

module.exports = {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  getOrganizerEvents,
  getEventAttendees,
  getEventCategories,
  getUserCreatedEvents,
  getUserApprovedEvents,
  getUserAttendingEvents,
  getFreeEvents,
  issueOrganizerWarning,
  deleteEventByAdmin,
  getEventsForReview,
  reviewPostApprovalModification,
};
