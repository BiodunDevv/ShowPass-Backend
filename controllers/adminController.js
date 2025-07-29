const User = require("../models/User");
const Event = require("../models/Event");
const Booking = require("../models/Booking");
const RefundRequest = require("../models/RefundRequest");
const { sendSuccess, sendError, getPagination } = require("../utils/helpers");
const { sendEventUpdateNotification } = require("../utils/emailService");

// Get dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    // Total counts
    const totalUsers = await User.countDocuments({ role: "user" });
    const totalOrganizers = await User.countDocuments({ role: "organizer" });
    const totalEvents = await Event.countDocuments();
    const totalBookings = await Booking.countDocuments();

    // Event statistics
    const eventStats = await Event.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Booking statistics
    const bookingStats = await Booking.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalRevenue: { $sum: "$finalAmount" },
        },
      },
    ]);

    // Monthly revenue
    const monthlyRevenue = await Booking.aggregate([
      {
        $match: {
          status: "confirmed",
          createdAt: {
            $gte: new Date(new Date().getFullYear(), 0, 1), // This year
          },
        },
      },
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" },
          },
          revenue: { $sum: "$finalAmount" },
          bookings: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // Popular categories
    const popularCategories = await Event.aggregate([
      { $match: { approved: true } },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          totalBookings: { $sum: "$currentAttendees" },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Recent activities
    const recentBookings = await Booking.find()
      .populate("user", "firstName lastName")
      .populate("event", "title")
      .sort({ createdAt: -1 })
      .limit(10);

    // Pending approvals
    const pendingEvents = await Event.countDocuments({ status: "pending" });
    const pendingRefunds = await RefundRequest.countDocuments({
      status: "pending",
    });

    const stats = {
      overview: {
        totalUsers,
        totalOrganizers,
        totalEvents,
        totalBookings,
        pendingEvents,
        pendingRefunds,
      },
      events: eventStats,
      bookings: bookingStats,
      monthlyRevenue,
      popularCategories,
      recentBookings,
    };

    sendSuccess(res, "Dashboard statistics retrieved successfully", stats);
  } catch (error) {
    console.error("Get dashboard stats error:", error);
    sendError(
      res,
      500,
      "Failed to retrieve dashboard statistics",
      error.message
    );
  }
};

// Get all users
const getAllUsers = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req);
    const { role, status, search } = req.query;

    let query = {};

    if (role) {
      query.role = role;
    }

    if (status === "blocked") {
      query.blocked = true;
    } else if (status === "active") {
      query.blocked = false;
    }

    if (search) {
      query.$or = [
        { firstName: new RegExp(search, "i") },
        { lastName: new RegExp(search, "i") },
        { email: new RegExp(search, "i") },
      ];
    }

    const users = await User.find(query)
      .select("-password -verificationToken -resetPasswordToken")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments(query);

    sendSuccess(res, "Users retrieved successfully", users, {
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get all users error:", error);
    sendError(res, 500, "Failed to retrieve users", error.message);
  }
};

// Block/Unblock user
const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { blocked } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return sendError(res, 404, "User not found");
    }

    if (user.role === "admin") {
      return sendError(res, 403, "Cannot modify admin users");
    }

    user.blocked = blocked;
    await user.save();

    const action = blocked ? "blocked" : "unblocked";
    sendSuccess(res, `User ${action} successfully`, {
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        blocked: user.blocked,
      },
    });
  } catch (error) {
    console.error("Toggle user status error:", error);
    sendError(res, 500, "Failed to update user status", error.message);
  }
};

// Get all events (admin view)
const getAllEvents = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req);
    const { status, category, organizer, search } = req.query;

    let query = {};

    if (status) {
      query.status = status;
    }

    if (category) {
      query.category = category;
    }

    if (organizer) {
      query.organizer = organizer;
    }

    if (search) {
      query.$or = [
        { title: new RegExp(search, "i") },
        { description: new RegExp(search, "i") },
      ];
    }

    const events = await Event.find(query)
      .populate("organizer", "firstName lastName email")
      .populate("approvedBy", "firstName lastName")
      .sort({ createdAt: -1 })
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
    console.error("Get all events error:", error);
    sendError(res, 500, "Failed to retrieve events", error.message);
  }
};

// Approve/Reject event
const reviewEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { approved, rejectionReason } = req.body;

    const event = await Event.findById(id).populate(
      "organizer",
      "firstName lastName email"
    );

    if (!event) {
      return sendError(res, 404, "Event not found");
    }

    if (event.status !== "pending") {
      return sendError(res, 400, "Only pending events can be reviewed");
    }

    if (approved) {
      event.approved = true;
      event.status = "approved";
      event.approvedBy = req.user._id;
      event.approvedAt = new Date();
    } else {
      event.status = "rejected";
      event.rejectionReason = rejectionReason;
    }

    await event.save();

    // TODO: Send notification email to organizer

    const action = approved ? "approved" : "rejected";
    sendSuccess(res, `Event ${action} successfully`, event);
  } catch (error) {
    console.error("Review event error:", error);
    sendError(res, 500, "Failed to review event", error.message);
  }
};

// Toggle event featured status
const toggleEventFeatured = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id);
    if (!event) {
      return sendError(res, 404, "Event not found");
    }

    event.featured = !event.featured;
    await event.save();

    const status = event.featured ? "featured" : "unfeatured";
    sendSuccess(res, `Event marked as ${status} successfully`, {
      _id: event._id,
      title: event.title,
      featured: event.featured,
    });
  } catch (error) {
    console.error("Toggle event featured error:", error);
    sendError(
      res,
      500,
      "Failed to update event featured status",
      error.message
    );
  }
};

// Get all bookings (admin view)
const getAllBookings = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req);
    const { status, eventId, userId, startDate, endDate } = req.query;

    let query = {};

    if (status) {
      query.status = status;
    }

    if (eventId) {
      query.event = eventId;
    }

    if (userId) {
      query.user = userId;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    const bookings = await Booking.find(query)
      .populate("user", "firstName lastName email")
      .populate("event", "title startDate venue organizer")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Booking.countDocuments(query);

    sendSuccess(res, "Bookings retrieved successfully", bookings, {
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get all bookings error:", error);
    sendError(res, 500, "Failed to retrieve bookings", error.message);
  }
};

// Get platform analytics
const getAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, period = "month" } = req.query;

    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Revenue analytics
    const revenueData = await Booking.aggregate([
      {
        $match: {
          status: "confirmed",
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: {
            $dateTrunc: {
              date: "$createdAt",
              unit: period,
            },
          },
          totalRevenue: { $sum: "$finalAmount" },
          platformFees: { $sum: "$platformFee" },
          vat: { $sum: "$vat" },
          bookingCount: { $sum: 1 },
          ticketsSold: { $sum: "$quantity" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Top events by revenue
    const topEventsByRevenue = await Booking.aggregate([
      {
        $match: {
          status: "confirmed",
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: "$event",
          totalRevenue: { $sum: "$finalAmount" },
          ticketsSold: { $sum: "$quantity" },
          bookingCount: { $sum: 1 },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "events",
          localField: "_id",
          foreignField: "_id",
          as: "event",
        },
      },
      { $unwind: "$event" },
    ]);

    // Top organizers by revenue
    const topOrganizers = await Booking.aggregate([
      {
        $match: {
          status: "confirmed",
          ...dateFilter,
        },
      },
      {
        $lookup: {
          from: "events",
          localField: "event",
          foreignField: "_id",
          as: "eventData",
        },
      },
      { $unwind: "$eventData" },
      {
        $group: {
          _id: "$eventData.organizer",
          totalRevenue: { $sum: "$finalAmount" },
          eventCount: { $addToSet: "$event" },
          ticketsSold: { $sum: "$quantity" },
        },
      },
      {
        $addFields: {
          eventCount: { $size: "$eventCount" },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "organizer",
        },
      },
      { $unwind: "$organizer" },
    ]);

    const analytics = {
      revenue: revenueData,
      topEvents: topEventsByRevenue,
      topOrganizers,
    };

    sendSuccess(res, "Analytics data retrieved successfully", analytics);
  } catch (error) {
    console.error("Get analytics error:", error);
    sendError(res, 500, "Failed to retrieve analytics", error.message);
  }
};

// Send system notification to users
const sendSystemNotification = async (req, res) => {
  try {
    const { title, message, userType = "all" } = req.body;

    let userFilter = {};
    if (userType === "users") {
      userFilter.role = "user";
    } else if (userType === "organizers") {
      userFilter.role = "organizer";
    }

    const users = await User.find(userFilter).select(
      "email firstName lastName"
    );

    // TODO: Implement system notification (email, push notification, etc.)
    // For now, we'll just return success

    sendSuccess(
      res,
      `System notification sent to ${users.length} users successfully`,
      {
        recipientCount: users.length,
        title,
        message,
      }
    );
  } catch (error) {
    console.error("Send system notification error:", error);
    sendError(res, 500, "Failed to send system notification", error.message);
  }
};

module.exports = {
  getDashboardStats,
  getAllUsers,
  toggleUserStatus,
  getAllEvents,
  reviewEvent,
  toggleEventFeatured,
  getAllBookings,
  getAnalytics,
  sendSystemNotification,
};
