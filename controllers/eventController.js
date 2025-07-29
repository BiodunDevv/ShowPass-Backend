const Event = require("../models/Event");
const User = require("../models/User");
const Booking = require("../models/Booking");
const { sendSuccess, sendError, getPagination } = require("../utils/helpers");

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
    });

    await event.save();
    await event.populate("organizer", "firstName lastName email");

    sendSuccess(
      res,
      "Event created successfully! It will be visible after admin approval.",
      event
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

    // If major changes are made, reset approval status
    const majorChangeFields = ["startDate", "endDate", "venue", "ticketTypes"];
    const hasMajorChanges = majorChangeFields.some(
      (field) => updates[field] !== undefined
    );

    if (hasMajorChanges && event.approved) {
      event.approved = false;
      event.status = "pending";
      // TODO: Notify attendees about changes
    }

    await event.save();
    await event.populate("organizer", "firstName lastName email");

    sendSuccess(res, "Event updated successfully", event);
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

module.exports = {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  getOrganizerEvents,
  getEventAttendees,
  getEventCategories,
};
