const Event = require("../models/Event");
const mongoose = require("mongoose");
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
  sendAdminEventDeletionNotification,
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

    // Validate that user is organizer only
    if (req.user.role !== "organizer") {
      return sendError(res, 403, "Only organizers can create events");
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

    // Validate event ID format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return sendError(res, 400, "Invalid event ID format");
    }

    const event = await Event.findById(id)
      .populate("organizer", "firstName lastName email phone")
      .populate("approvedBy", "firstName lastName")
      .populate("flaggedBy", "firstName lastName");

    if (!event) {
      return sendError(res, 404, "Event not found");
    }

    // Check if user is authenticated first
    if (!req.user) {
      // For unauthenticated users, only show approved public events
      if (!event.approved || event.status !== "approved" || !event.isPublic) {
        return sendError(res, 404, "Event not found");
      }
    } else {
      // For authenticated users, determine access permissions
      const isOwner =
        event.organizer._id.toString() === req.user._id.toString();
      const isAdmin = req.user.role === "admin";
      const isApproved = event.approved && event.status === "approved";
      const isPending = event.status === "pending";

      // Access control logic for authenticated users
      // Allow access if: event is approved OR user is admin OR user owns the event
      if (!isApproved && !isAdmin && !isOwner) {
        return sendError(res, 404, "Event not found");
      }
    }

    // Determine access permissions for response (safely handle unauthenticated users)
    const isOwner = req.user
      ? event.organizer._id.toString() === req.user._id.toString()
      : false;
    const isAdmin = req.user ? req.user.role === "admin" : false;
    const isApproved = event.approved && event.status === "approved";
    const isPending = event.status === "pending";

    // Prepare response data with additional context
    const eventData = {
      ...event.toObject(),
      accessContext: {
        canEdit: isOwner || isAdmin,
        canDelete: isOwner || isAdmin,
        canApprove: isAdmin && isPending,
        canFlag: isAdmin,
        viewingAs: isAdmin ? "admin" : isOwner ? "owner" : "public",
      },
      statusInfo: {
        isApproved,
        isPending,
        isOwner,
        requiresApproval: isPending && !isApproved,
        visibilityReason: !isApproved
          ? isOwner
            ? "You can view your own pending event"
            : "Admin can view all events"
          : "Event is publicly visible",
      },
    };

    // Add warning information for admins
    if (isAdmin && event.warnings?.length > 0) {
      eventData.adminInfo = {
        totalWarnings: event.warningCount,
        flaggedForDeletion: event.flaggedForDeletion,
        latestWarning: event.warnings[event.warnings.length - 1],
        unreviewed_modifications:
          event.postApprovalModifications?.filter((mod) => !mod.reviewedByAdmin)
            .length || 0,
      };
    }

    // Add booking statistics if user is owner or admin
    if (isOwner || isAdmin) {
      try {
        const bookingStats = await Booking.aggregate([
          { $match: { event: event._id } },
          {
            $group: {
              _id: "$status",
              count: { $sum: 1 },
              totalQuantity: { $sum: "$quantity" },
            },
          },
        ]);

        eventData.bookingStats = {
          confirmed:
            bookingStats.find((s) => s._id === "confirmed")?.count || 0,
          pending: bookingStats.find((s) => s._id === "pending")?.count || 0,
          cancelled:
            bookingStats.find((s) => s._id === "cancelled")?.count || 0,
          totalTicketsSold:
            bookingStats.find((s) => s._id === "confirmed")?.totalQuantity || 0,
        };
      } catch (statsError) {
        console.warn("Failed to fetch booking stats:", statsError);
      }
    }

    // Success message based on context
    let message = "Event retrieved successfully";
    if (!isApproved && isOwner) {
      message = "Your event retrieved successfully (pending approval)";
    } else if (!isApproved && isAdmin) {
      message = "Event retrieved successfully (admin view - pending approval)";
    }

    sendSuccess(res, message, eventData);
  } catch (error) {
    console.error("Get event error:", error);

    // Handle specific MongoDB errors
    if (error.name === "CastError") {
      return sendError(res, 400, "Invalid event ID format");
    }

    sendError(res, 500, "Failed to retrieve event", error.message);
  }
};

// Update event (organizer only)
const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Define updatable fields for validation
    const allowedFields = [
      "title",
      "description",
      "category",
      "venue",
      "startDate",
      "endDate",
      "startTime",
      "endTime",
      "ticketTypes",
      "images",
      "tags",
      "maxAttendees",
      "isPublic",
      "requiresApproval",
      "featured",
    ];

    // Define fields that admins can update but organizers cannot
    const adminOnlyFields = [
      "featured",
      "approved",
      "status",
      "rejectionReason",
    ];

    // Define restricted fields that cannot be updated
    const restrictedFields = [
      "organizer",
      "createdAt",
      "updatedAt",
      "_id",
      "approvedBy",
      "approvedAt",
      "currentAttendees",
      "notificationsSent",
      "warnings",
      "warningCount",
      "postApprovalModifications",
      "isFreeEvent",
    ];

    const event = await Event.findById(id);
    if (!event) {
      return sendError(res, 404, "Event not found");
    }

    // Check if user owns the event or is admin
    const isOwner = event.organizer.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return sendError(res, 403, "You can only update your own events");
    }

    // Validate updateable fields
    const invalidFields = Object.keys(updates).filter(
      (key) =>
        restrictedFields.includes(key) ||
        (!isAdmin && adminOnlyFields.includes(key))
    );

    if (invalidFields.length > 0) {
      return sendError(
        res,
        400,
        `Cannot update fields: ${invalidFields.join(", ")}`
      );
    }

    // Don't allow updating certain fields after approval (unless admin)
    if (event.approved && updates.ticketTypes && !isAdmin) {
      return sendError(
        res,
        400,
        "Cannot modify ticket types after event is approved. Please contact admin for major changes."
      );
    }

    // Validate ticket types if provided
    if (updates.ticketTypes) {
      const ticketValidation = validateFreeEventTickets(updates.ticketTypes);
      if (!ticketValidation.isValid) {
        return sendError(res, 400, ticketValidation.message);
      }
    }

    // Validate dates if provided
    if (updates.startDate && updates.endDate) {
      if (new Date(updates.startDate) >= new Date(updates.endDate)) {
        return sendError(res, 400, "Start date must be before end date");
      }
    } else if (
      updates.startDate &&
      new Date(updates.startDate) >= new Date(event.endDate)
    ) {
      return sendError(res, 400, "Start date must be before current end date");
    } else if (
      updates.endDate &&
      new Date(event.startDate) >= new Date(updates.endDate)
    ) {
      return sendError(res, 400, "End date must be after current start date");
    }

    // Validate maxAttendees if provided
    if (updates.maxAttendees && updates.maxAttendees < event.currentAttendees) {
      return sendError(
        res,
        400,
        `Cannot reduce max attendees below current attendees (${event.currentAttendees})`
      );
    }

    // Check if the event is free and handle isFreeEvent flag
    if (updates.ticketTypes) {
      const isFree = checkEventIsFree(updates.ticketTypes);
      updates.isFreeEvent = isFree;
    }

    // Update event fields
    Object.keys(updates).forEach((key) => {
      if (updates[key] !== undefined && allowedFields.includes(key)) {
        if (key === "venue" && typeof updates[key] === "object") {
          // Handle venue object updates
          event.venue = { ...event.venue.toObject(), ...updates[key] };
        } else {
          event[key] = updates[key];
        }
      }
    });

    // Define major change fields first (venue, dates, and times are now considered minor changes)
    // Major changes reset approval status and require re-approval
    // Minor changes (venue, title, description, times, dates, etc.) maintain approval status
    const majorChangeFields = ["ticketTypes"];

    // Generate change details for different recipients
    const userChangeDetails = generateChangeDetails(
      updates,
      majorChangeFields,
      "user"
    );
    const organizerChangeDetails = generateChangeDetails(
      updates,
      majorChangeFields,
      "organizer"
    );
    const adminChangeDetails = generateChangeDetails(
      updates,
      majorChangeFields,
      "admin"
    );

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
        });

        if (bookings.length > 0) {
          // Manually populate users using UserManager for multi-collection support
          const UserManager = require("../utils/UserManager");
          const populatedBookings = [];

          for (const booking of bookings) {
            const userResult = await UserManager.findById(booking.user);
            if (userResult && userResult.user) {
              populatedBookings.push({
                ...booking.toObject(),
                user: userResult.user,
              });
            }
          }

          // Use the change details message already generated
          // Send notifications to all attendees with populated user data
          for (const booking of populatedBookings) {
            try {
              await sendEventUpdateNotification(
                booking.user,
                event,
                userChangeDetails
              );
            } catch (emailError) {
              console.error(
                `Failed to send update notification to ${booking.user.email}:`,
                emailError
              );
            }
          }

          console.log(
            `📧 Event update notifications sent to ${populatedBookings.length} attendees`
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
          "venue",
        ];
        const hasNotifiableChanges = notifiableFields.some(
          (field) => updates[field] !== undefined
        );

        if (hasNotifiableChanges) {
          // Get all confirmed bookings for this event
          const bookings = await Booking.find({
            event: event._id,
            status: "confirmed",
          });

          if (bookings.length > 0) {
            // Manually populate users using UserManager for multi-collection support
            const UserManager = require("../utils/UserManager");
            const populatedBookings = [];

            for (const booking of bookings) {
              const userResult = await UserManager.findById(booking.user);
              if (userResult && userResult.user) {
                populatedBookings.push({
                  ...booking.toObject(),
                  user: userResult.user,
                });
              }
            }

            // Use the change details message already generated for minor changes
            // Send notifications to all attendees with populated user data
            for (const booking of populatedBookings) {
              try {
                await sendEventUpdateNotification(
                  booking.user,
                  event,
                  userChangeDetails
                );
              } catch (emailError) {
                console.error(
                  `Failed to send minor update notification to ${booking.user.email}:`,
                  emailError
                );
              }
            }

            console.log(
              `📧 Minor event update notifications sent to ${populatedBookings.length} attendees`
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
        organizerChangeDetails
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
          adminChangeDetails
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
    const { reason } = req.body; // Optional deletion reason

    const event = await Event.findById(id).populate(
      "organizer",
      "firstName lastName email"
    );
    if (!event) {
      return sendError(res, 404, "Event not found");
    }

    // Check if user owns the event or is admin
    if (
      event.organizer._id.toString() !== req.user._id.toString() &&
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

    // Store event details before deletion for notifications
    const eventDetails = {
      _id: event._id,
      title: event.title,
      description: event.description,
      startDate: event.startDate,
      venue: event.venue,
      organizer: event.organizer,
      deletedBy: req.user,
      deletionReason: reason || "Event deleted by organizer",
      isAdminDeletion: req.user.role === "admin",
    };

    await Event.findByIdAndDelete(id);

    // Always send deletion notification to organizer (confirmation email)
    try {
      await sendEventDeletionNotification(
        event.organizer,
        eventDetails,
        eventDetails.deletionReason
      );
      console.log(
        `📧 Event deletion notification sent to organizer: ${event.organizer.email}`
      );
    } catch (emailError) {
      console.error(
        "Failed to send organizer deletion notification:",
        emailError
      );
    }

    // Send deletion notification to all admins (if organizer deleted their own event)
    if (req.user.role !== "admin") {
      try {
        const admins = await UserManager.getAllAdmins();
        for (const admin of admins) {
          await sendAdminEventDeletionNotification(
            admin,
            eventDetails,
            event.organizer
          );
          console.log(`📧 Admin deletion notification sent to: ${admin.email}`);
        }
      } catch (emailError) {
        console.error(
          "Failed to send admin deletion notifications:",
          emailError
        );
      }
    }

    sendSuccess(res, "Event deleted successfully", {
      eventTitle: event.title,
      deletedBy: req.user.role,
      reason: eventDetails.deletionReason,
    });
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
    const { status, search } = req.query; // Optional filters

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

    // Build query - fetch all bookings by default, or filter by status if provided
    const query = { event: id };
    if (status) {
      query.status = status;
    }

    // Get all bookings without pagination
    const bookings = await Booking.find(query).sort({ createdAt: -1 });

    // Manually populate users using UserManager for multi-collection support
    const UserManager = require("../utils/UserManager");
    const populatedBookings = [];

    for (const booking of bookings) {
      const userResult = await UserManager.findById(booking.user);
      if (userResult && userResult.user) {
        populatedBookings.push({
          ...booking.toObject(),
          user: userResult.user,
        });
      }
    }

    // Apply search filter if provided (search by attendee names or user name)
    let filteredBookings = populatedBookings;
    if (search && search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      filteredBookings = populatedBookings.filter((booking) => {
        // Search in user name
        const userFullName = `${booking.user.firstName || ""} ${
          booking.user.lastName || ""
        }`.toLowerCase();
        const userEmail = (booking.user.email || "").toLowerCase();

        // Search in attendee info
        const attendeeMatches =
          booking.attendeeInfo?.some((attendee) => {
            const attendeeName = (attendee.name || "").toLowerCase();
            const attendeeEmail = (attendee.email || "").toLowerCase();
            return (
              attendeeName.includes(searchTerm) ||
              attendeeEmail.includes(searchTerm)
            );
          }) || false;

        return (
          userFullName.includes(searchTerm) ||
          userEmail.includes(searchTerm) ||
          attendeeMatches
        );
      });
    }

    // Calculate status summary using the filtered results
    const statusSummary = {
      total: populatedBookings.length,
      confirmed: populatedBookings.filter((b) => b.status === "confirmed")
        .length,
      pending: populatedBookings.filter((b) => b.status === "pending").length,
      cancelled: populatedBookings.filter((b) => b.status === "cancelled")
        .length,
      refunded: populatedBookings.filter((b) => b.status === "refunded").length,
      used: populatedBookings.filter((b) => b.status === "used").length,
    };

    // Flatten attendee data for easier frontend consumption
    const attendeeList = [];
    filteredBookings.forEach((booking) => {
      // Add booking user as first attendee if not in attendee list
      const userInAttendees = booking.attendeeInfo?.some(
        (att) => att.email === booking.user.email
      );

      if (!userInAttendees) {
        attendeeList.push({
          bookingId: booking._id,
          attendeeType: "booker",
          name: `${booking.user.firstName} ${booking.user.lastName}`,
          email: booking.user.email,
          phone: booking.user.phone || "",
          bookingStatus: booking.status,
          ticketType: booking.ticketType,
          bookingDate: booking.createdAt,
          totalAmount: booking.finalAmount,
          paymentReference: booking.paymentReference,
          isCheckedIn: booking.isCheckedIn,
          checkInTime: booking.checkInTime,
          verificationCodes:
            booking.verificationCodes?.map((code) => ({
              code: code.code,
              ticketNumber: code.ticketNumber,
              isUsed: code.isUsed,
              checkInTime: code.checkInTime,
            })) || [],
        });
      }

      // Add all attendees from attendeeInfo
      if (booking.attendeeInfo && booking.attendeeInfo.length > 0) {
        booking.attendeeInfo.forEach((attendee, index) => {
          const correspondingCode = booking.verificationCodes?.[index];
          attendeeList.push({
            bookingId: booking._id,
            attendeeType: "attendee",
            name: attendee.name,
            email: attendee.email,
            phone: attendee.phone || "",
            bookingStatus: booking.status,
            ticketType: booking.ticketType,
            bookingDate: booking.createdAt,
            totalAmount: booking.finalAmount / booking.quantity, // Per-attendee amount
            paymentReference: booking.paymentReference,
            isCheckedIn: correspondingCode?.isUsed || false,
            checkInTime: correspondingCode?.checkInTime,
            verificationCode: correspondingCode?.code,
            ticketNumber: correspondingCode?.ticketNumber,
          });
        });
      }
    });

    const message = search
      ? `Found ${attendeeList.length} attendees matching "${search}"`
      : status
      ? `Event attendees with status '${status}' retrieved successfully`
      : "All event attendees retrieved successfully";

    sendSuccess(res, message, {
      attendees: attendeeList,
      totalAttendees: attendeeList.length,
      totalBookings: filteredBookings.length,
      statusSummary,
      appliedFilters: {
        status: status || null,
        search: search || null,
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
const generateChangeDetails = (
  updates,
  majorChangeFields,
  recipient = "user"
) => {
  const changes = [];

  // Format based on recipient type
  const isEmailFormat =
    recipient === "user" || recipient === "organizer" || recipient === "admin";

  if (updates.title) {
    changes.push(
      isEmailFormat
        ? `📝 <strong>Event Title:</strong> Changed to "${updates.title}"`
        : `📝 Event title changed to "${updates.title}"`
    );
  }

  if (updates.description) {
    changes.push(
      isEmailFormat
        ? `📄 <strong>Event Description:</strong> Event description has been updated`
        : `📄 Event description has been updated`
    );
  }

  if (updates.category) {
    changes.push(
      isEmailFormat
        ? `🏷️ <strong>Event Category:</strong> Changed to ${updates.category}`
        : `🏷️ Event category changed to ${updates.category}`
    );
  }

  if (updates.startDate || updates.endDate) {
    if (updates.startDate) {
      changes.push(
        isEmailFormat
          ? `📅 <strong>Event Start Date:</strong> Changed to ${new Date(
              updates.startDate
            ).toLocaleDateString()}`
          : `📅 Event date changed to ${new Date(
              updates.startDate
            ).toLocaleDateString()}`
      );
    }
    if (updates.endDate) {
      changes.push(
        isEmailFormat
          ? `📅 <strong>Event End Date:</strong> Changed to ${new Date(
              updates.endDate
            ).toLocaleDateString()}`
          : `📅 Event end date changed to ${new Date(
              updates.endDate
            ).toLocaleDateString()}`
      );
    }
  }

  if (updates.startTime || updates.endTime) {
    if (updates.startTime) {
      changes.push(
        isEmailFormat
          ? `🕐 <strong>Start Time:</strong> Changed to ${updates.startTime}`
          : `🕐 Start time changed to ${updates.startTime}`
      );
    }
    if (updates.endTime) {
      changes.push(
        isEmailFormat
          ? `🕐 <strong>End Time:</strong> Changed to ${updates.endTime}`
          : `🕐 End time changed to ${updates.endTime}`
      );
    }
  }

  if (updates.venue) {
    const venueChanges = [];
    if (updates.venue.name) {
      venueChanges.push(`Venue: ${updates.venue.name}`);
    }
    if (updates.venue.address) {
      venueChanges.push(`Address: ${updates.venue.address}`);
    }
    if (updates.venue.city && updates.venue.state) {
      venueChanges.push(
        `Location: ${updates.venue.city}, ${updates.venue.state}`
      );
    }

    if (venueChanges.length > 0) {
      changes.push(
        isEmailFormat
          ? `📍 <strong>Venue Information:</strong><br/>&nbsp;&nbsp;&nbsp;&nbsp;${venueChanges.join(
              "<br/>&nbsp;&nbsp;&nbsp;&nbsp;"
            )}`
          : `📍 Venue updated: ${venueChanges.join(", ")}`
      );
    }
  }

  if (updates.ticketTypes) {
    changes.push(
      isEmailFormat
        ? `🎟️ <strong>Ticket Information:</strong> Ticket types and pricing have been updated`
        : `🎟️ Ticket types and pricing have been updated`
    );
  }

  if (updates.maxAttendees) {
    changes.push(
      isEmailFormat
        ? `� <strong>Capacity:</strong> Maximum attendees changed to ${updates.maxAttendees}`
        : `👥 Maximum attendees changed to ${updates.maxAttendees}`
    );
  }

  if (updates.images && updates.images.length > 0) {
    changes.push(
      isEmailFormat
        ? `�️ <strong>Event Images:</strong> Event photos have been updated`
        : `🖼️ Event photos have been updated`
    );
  }

  if (updates.tags && updates.tags.length > 0) {
    changes.push(
      isEmailFormat
        ? `🏷️ <strong>Event Tags:</strong> Event tags have been updated`
        : `🏷️ Event tags have been updated`
    );
  }

  if (updates.isPublic !== undefined) {
    changes.push(
      isEmailFormat
        ? `👁️ <strong>Visibility:</strong> Event is now ${
            updates.isPublic ? "public" : "private"
          }`
        : `👁️ Event visibility changed to ${
            updates.isPublic ? "public" : "private"
          }`
    );
  }

  const separator = isEmailFormat ? "<br/><br/>" : "<br/>";

  return changes.length > 0
    ? changes.join(separator)
    : isEmailFormat
    ? "Event details have been updated. Please review the current information."
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
