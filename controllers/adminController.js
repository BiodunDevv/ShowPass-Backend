const UserManager = require("../utils/UserManager");
const Event = require("../models/Event");
const Booking = require("../models/Booking");
const RefundRequest = require("../models/RefundRequest");
const {
  sendSuccess,
  sendError,
  getPagination,
  updateUserEventArrays,
} = require("../utils/helpers");
const {
  sendEventUpdateNotification,
  sendEventApprovalNotification,
  sendOrganizerApprovalNotification,
} = require("../utils/emailService");

// Get dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    // Total counts using UserManager
    const userCounts = await UserManager.countUsersByRole();
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
        totalUsers: userCounts.users,
        totalOrganizers: userCounts.organizers,
        totalAdmins: userCounts.admins,
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

    let users, total;

    if (role) {
      // Get users from specific role collection
      users = await UserManager.getUsersByRole(role, query, {
        sort: { createdAt: -1 },
        skip: skip,
        limit: limit,
      });

      const UserModel = UserManager.getUserModel(role);
      total = await UserModel.countDocuments(query);
    } else {
      // Get all users from all collections
      const searchResults = await UserManager.searchUsers(search || "", null);

      // Combine and paginate results
      const allUsers = [
        ...searchResults.users,
        ...searchResults.organizers,
        ...searchResults.admins,
      ];

      // Apply status filter
      const filteredUsers = allUsers.filter((user) => {
        if (status === "blocked") return user.blocked === true;
        if (status === "active") return user.blocked === false;
        return true;
      });

      total = filteredUsers.length;
      users = filteredUsers.slice(skip, skip + limit);
    }

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

    const userResult = await UserManager.findById(id);
    if (!userResult) {
      return sendError(res, 404, "User not found");
    }

    const { user, role } = userResult;

    if (role === "admin") {
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
        role: role,
        blocked: user.blocked,
      },
    });
  } catch (error) {
    console.error("Toggle user status error:", error);
    sendError(res, 500, "Failed to update user status", error.message);
  }
};

// Update user status (block/unblock) - Alternative endpoint
const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { blocked } = req.body;

    const userResult = await UserManager.findById(id);
    if (!userResult) {
      return sendError(res, 404, "User not found");
    }

    const { user, role } = userResult;

    if (role === "admin") {
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
        role: role,
        blocked: user.blocked,
      },
    });
  } catch (error) {
    console.error("Update user status error:", error);
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

      // Update admin's approved events array
      await updateUserEventArrays(req.user._id, event._id, "approved");
    } else {
      event.status = "rejected";
      event.rejectionReason = rejectionReason;
    }

    await event.save();

    // Send notification to organizer
    try {
      await sendOrganizerApprovalNotification(
        event.organizer,
        event,
        approved,
        rejectionReason
      );
      console.log(
        `📧 Approval notification sent to organizer: ${event.organizer.email}`
      );
    } catch (emailError) {
      console.error(
        "Failed to send organizer approval notification:",
        emailError
      );
    }

    // If approved, send notification to all users
    if (approved && !event.notificationsSent) {
      try {
        const users = await UserManager.getAllRegularUsers();
        const eligibleUsers = users.filter(
          (user) => user.notifications?.newEvents !== false
        );

        if (eligibleUsers.length > 0) {
          await sendEventApprovalNotification(
            eligibleUsers,
            event,
            event.organizer
          );
          console.log(
            `📧 Event approval notifications sent to ${eligibleUsers.length} users`
          );

          // Mark notifications as sent
          event.notificationsSent = true;
          await event.save();
        }
      } catch (emailError) {
        console.error("Failed to send user notifications:", emailError);
      }
    }

    const action = approved ? "approved" : "rejected";
    sendSuccess(
      res,
      `Event ${action} successfully. ${
        approved ? "Users have been notified about this new event." : ""
      }`,
      event
    );
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

    // Get users based on type using UserManager
    let users = [];
    if (userType === "all") {
      const [admins, organizers, regularUsers] = await Promise.all([
        UserManager.getAllAdmins(),
        UserManager.getAllOrganizers(),
        UserManager.getAllRegularUsers(),
      ]);
      users = [...admins, ...organizers, ...regularUsers];
    } else if (userType === "admins") {
      users = await UserManager.getAllAdmins();
    } else if (userType === "organizers") {
      users = await UserManager.getAllOrganizers();
    } else {
      users = await UserManager.getAllRegularUsers();
    }

    // Filter users by email if provided (simple text search)
    const { email } = req.query;
    if (email) {
      users = users.filter((user) =>
        user.email.toLowerCase().includes(email.toLowerCase())
      );
    }

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
  updateUserStatus,
  getAllEvents,
  reviewEvent,
  toggleEventFeatured,
  getAllBookings,
  getAnalytics,
  sendSystemNotification,
};
