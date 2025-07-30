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
  sendOrganizerWarningNotification,
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
      .populate("event", "title startDate")
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

// Search users by various criteria
const searchUsers = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req);
    const {
      email,
      name,
      firstName,
      lastName,
      role,
      status,
      phone,
      search, // General search term
    } = req.query;

    console.log("🔍 Admin User Search Parameters:", req.query);

    let searchQuery = {};
    let searchConditions = [];

    // Build search conditions based on provided parameters
    if (email) {
      searchConditions.push({ email: new RegExp(email, "i") });
    }

    if (firstName) {
      searchConditions.push({ firstName: new RegExp(firstName, "i") });
    }

    if (lastName) {
      searchConditions.push({ lastName: new RegExp(lastName, "i") });
    }

    if (name) {
      // Search in both first name and last name for general name query
      searchConditions.push(
        { firstName: new RegExp(name, "i") },
        { lastName: new RegExp(name, "i") }
      );
    }

    if (phone) {
      searchConditions.push({ phone: new RegExp(phone, "i") });
    }

    // General search across multiple fields
    if (search) {
      searchConditions.push(
        { firstName: new RegExp(search, "i") },
        { lastName: new RegExp(search, "i") },
        { email: new RegExp(search, "i") },
        { phone: new RegExp(search, "i") }
      );
    }

    // Combine search conditions with OR
    if (searchConditions.length > 0) {
      searchQuery.$or = searchConditions;
    }

    // Add status filter
    if (status === "blocked") {
      searchQuery.blocked = true;
    } else if (status === "active") {
      searchQuery.blocked = false;
    }

    console.log("🔍 Final Search Query:", JSON.stringify(searchQuery, null, 2));

    let users = [];
    let total = 0;

    if (role && role !== "all") {
      // Search in specific role collection
      console.log(`🔍 Searching in ${role} collection...`);

      const UserModel = UserManager.getUserModel(role);
      users = await UserModel.find(searchQuery)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      // Add role information to each user
      users = users.map((user) => ({ ...user, role }));

      total = await UserModel.countDocuments(searchQuery);

      console.log(`✅ Found ${users.length} ${role}s (${total} total)`);
    } else {
      // Search across all role collections
      console.log("🔍 Searching across all user types...");

      const [userResults, organizerResults, adminResults] = await Promise.all([
        UserManager.getUserModel("user")
          .find(searchQuery)
          .select("-password")
          .sort({ createdAt: -1 })
          .lean(),
        UserManager.getUserModel("organizer")
          .find(searchQuery)
          .select("-password")
          .sort({ createdAt: -1 })
          .lean(),
        UserManager.getUserModel("admin")
          .find(searchQuery)
          .select("-password")
          .sort({ createdAt: -1 })
          .lean(),
      ]);

      // Add role information and combine results
      const allUsers = [
        ...userResults.map((user) => ({ ...user, role: "user" })),
        ...organizerResults.map((user) => ({ ...user, role: "organizer" })),
        ...adminResults.map((user) => ({ ...user, role: "admin" })),
      ];

      // Sort by creation date
      allUsers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      total = allUsers.length;
      users = allUsers.slice(skip, skip + limit);

      console.log(
        `✅ Found ${userResults.length} users, ${organizerResults.length} organizers, ${adminResults.length} admins`
      );
      console.log(
        `📄 Returning ${users.length} results (page ${
          Math.floor(skip / limit) + 1
        })`
      );
    }

    // Enhance user data with additional info
    const enhancedUsers = users.map((user) => ({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone || "N/A",
      role: user.role,
      blocked: user.blocked || false,
      verified: user.verified || false,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin || "Never",
      // Add full name for easier display
      fullName: `${user.firstName} ${user.lastName}`,
      // Add account status
      accountStatus: user.blocked ? "Blocked" : "Active",
    }));

    const response = {
      users: enhancedUsers,
      searchCriteria: {
        email,
        name,
        firstName,
        lastName,
        role: role || "all",
        status,
        phone,
        generalSearch: search,
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: skip + limit < total,
        hasPrev: skip > 0,
      },
    };

    sendSuccess(
      res,
      `Found ${total} user(s) matching search criteria`,
      response
    );
  } catch (error) {
    console.error("🚨 Search users error:", error);
    sendError(res, 500, "Failed to search users", error.message);
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

// Send warning to organizer for event that doesn't meet business standards
const warnOrganizer = async (req, res) => {
  try {
    const { id } = req.params; // Event ID
    const { reason, severity = "minor", autoDeleteAfterDays } = req.body;

    if (!reason) {
      return sendError(res, 400, "Warning reason is required");
    }

    const event = await Event.findById(id).populate(
      "organizer",
      "firstName lastName email"
    );

    if (!event) {
      return sendError(res, 404, "Event not found");
    }

    // Create warning object
    const warning = {
      adminId: req.user._id,
      reason,
      issuedAt: new Date(),
      severity,
    };

    // Add warning to event
    event.warnings.push(warning);
    event.warningCount = event.warnings.length;

    // Flag for deletion if specified
    if (autoDeleteAfterDays && autoDeleteAfterDays > 0) {
      event.flaggedForDeletion = true;
      event.flaggedBy = req.user._id;
      event.deletionDeadline = new Date(
        Date.now() + autoDeleteAfterDays * 24 * 60 * 60 * 1000
      );
    }

    await event.save();

    // Send warning notification to organizer
    try {
      await sendOrganizerWarningNotification(event.organizer, event, {
        reason,
        severity,
        autoDeleteAfterDays,
        warningCount: event.warningCount,
        adminName: `${req.user.firstName} ${req.user.lastName}`,
      });
      console.log(
        `📧 Warning notification sent to organizer: ${event.organizer.email}`
      );
    } catch (emailError) {
      console.error("Failed to send warning notification:", emailError);
    }

    sendSuccess(
      res,
      `Warning sent to organizer successfully. ${
        autoDeleteAfterDays
          ? `Event will be auto-deleted in ${autoDeleteAfterDays} days if not corrected.`
          : ""
      }`,
      {
        eventId: event._id,
        eventTitle: event.title,
        organizer: {
          name: `${event.organizer.firstName} ${event.organizer.lastName}`,
          email: event.organizer.email,
        },
        warning: {
          reason,
          severity,
          warningCount: event.warningCount,
          flaggedForDeletion: event.flaggedForDeletion,
          deletionDeadline: event.deletionDeadline,
        },
      }
    );
  } catch (error) {
    console.error("Warn organizer error:", error);
    sendError(res, 500, "Failed to send warning", error.message);
  }
};

// Get events flagged for deletion
const getFlaggedEvents = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req);

    const events = await Event.find({ flaggedForDeletion: true })
      .populate("organizer", "firstName lastName email")
      .populate("flaggedBy", "firstName lastName")
      .sort({ deletionDeadline: 1 }) // Sort by deadline (closest first)
      .skip(skip)
      .limit(limit);

    const total = await Event.countDocuments({ flaggedForDeletion: true });

    // Calculate time remaining for each event
    const eventsWithTimeRemaining = events.map((event) => {
      const timeRemaining = event.deletionDeadline - new Date();
      const daysRemaining = Math.max(
        0,
        Math.ceil(timeRemaining / (24 * 60 * 60 * 1000))
      );

      return {
        ...event.toObject(),
        daysRemaining,
        overdue: timeRemaining <= 0,
      };
    });

    sendSuccess(
      res,
      "Flagged events retrieved successfully",
      eventsWithTimeRemaining,
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
    console.error("Get flagged events error:", error);
    sendError(res, 500, "Failed to retrieve flagged events", error.message);
  }
};

// Auto-delete overdue flagged events
const autoDeleteOverdueEvents = async (req, res) => {
  try {
    const overdueEvents = await Event.find({
      flaggedForDeletion: true,
      deletionDeadline: { $lte: new Date() },
    }).populate("organizer", "firstName lastName email");

    const deletedEvents = [];

    for (const event of overdueEvents) {
      try {
        // Cancel associated bookings first
        const bookings = await Booking.find({ event: event._id });
        for (const booking of bookings) {
          booking.status = "cancelled";
          await booking.save();
        }

        // Store event info before deletion
        deletedEvents.push({
          id: event._id,
          title: event.title,
          organizer: event.organizer,
          deletionDate: new Date(),
        });

        // Delete the event
        await Event.findByIdAndDelete(event._id);

        console.log(`🗑️ Auto-deleted overdue event: ${event.title}`);
      } catch (deleteError) {
        console.error(`Failed to delete event ${event.title}:`, deleteError);
      }
    }

    sendSuccess(
      res,
      `${deletedEvents.length} overdue events have been automatically deleted`,
      {
        deletedEventsCount: deletedEvents.length,
        deletedEvents: deletedEvents.map((e) => ({
          title: e.title,
          organizer: `${e.organizer.firstName} ${e.organizer.lastName}`,
        })),
      }
    );
  } catch (error) {
    console.error("Auto delete overdue events error:", error);
    sendError(res, 500, "Failed to auto-delete overdue events", error.message);
  }
};

// Remove flag from event (unflag)
const unflagEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findById(id);
    if (!event) {
      return sendError(res, 404, "Event not found");
    }

    event.flaggedForDeletion = false;
    event.flaggedBy = null;
    event.deletionDeadline = null;
    await event.save();

    sendSuccess(res, "Event unflagged successfully", {
      eventId: event._id,
      title: event.title,
      flaggedForDeletion: event.flaggedForDeletion,
    });
  } catch (error) {
    console.error("Unflag event error:", error);
    sendError(res, 500, "Failed to unflag event", error.message);
  }
};

// Get event warnings history
const getEventWarnings = async (req, res) => {
  try {
    const { id } = req.params; // Event ID

    const event = await Event.findById(id)
      .populate("warnings.adminId", "firstName lastName")
      .populate("organizer", "firstName lastName email");

    if (!event) {
      return sendError(res, 404, "Event not found");
    }

    sendSuccess(res, "Event warnings retrieved successfully", {
      eventId: event._id,
      eventTitle: event.title,
      organizer: {
        name: `${event.organizer.firstName} ${event.organizer.lastName}`,
        email: event.organizer.email,
      },
      warningCount: event.warningCount,
      flaggedForDeletion: event.flaggedForDeletion,
      deletionDeadline: event.deletionDeadline,
      warnings: event.warnings.map((warning) => ({
        id: warning._id,
        reason: warning.reason,
        severity: warning.severity,
        issuedAt: warning.issuedAt,
        issuedBy: warning.adminId
          ? `${warning.adminId.firstName} ${warning.adminId.lastName}`
          : "Unknown Admin",
      })),
    });
  } catch (error) {
    console.error("Get event warnings error:", error);
    sendError(res, 500, "Failed to retrieve event warnings", error.message);
  }
};

module.exports = {
  getDashboardStats,
  getAllUsers,
  searchUsers,
  toggleUserStatus,
  updateUserStatus,
  getAllEvents,
  reviewEvent,
  toggleEventFeatured,
  getAllBookings,
  getAnalytics,
  sendSystemNotification,
  warnOrganizer,
  getFlaggedEvents,
  autoDeleteOverdueEvents,
  unflagEvent,
  getEventWarnings,
};
