const UserManager = require("../utils/UserManager");
const Event = require("../models/Event");
const Booking = require("../models/Booking");
const {
  sendSuccess,
  sendError,
  getPagination,
  sanitizeUser,
} = require("../utils/helpers");

// Get detailed user information (Admin/Organizer/User specific)
const getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUser = req.user;

    // Check permissions: admin can view all, users can view own profile, organizers can view attendees
    if (
      requestingUser.role !== "admin" &&
      requestingUser._id.toString() !== userId
    ) {
      // If organizer, check if they're requesting details of their event attendee
      if (requestingUser.role === "organizer") {
        const hasAttendeePermission = await checkOrganizerAttendeePermission(
          requestingUser._id,
          userId
        );
        if (!hasAttendeePermission) {
          return sendError(
            res,
            403,
            "You can only view details of your event attendees"
          );
        }
      } else {
        return sendError(res, 403, "Access denied");
      }
    }

    const userResult = await UserManager.findById(userId);
    if (!userResult) {
      return sendError(res, 404, "User not found");
    }

    const { user } = userResult;

    // Get comprehensive user details based on role
    let userDetails = {
      ...sanitizeUser(user),
      totalSpent: user.totalSpent || 0,
      purchaseHistory: user.purchaseHistory || [],
    };

    // Get user's events and bookings
    const [createdEvents, attendingEvents, bookingHistory] = await Promise.all([
      Event.find({ organizer: userId }).select(
        "title startDate status approved category venue.city"
      ),
      Booking.find({ user: userId, status: "confirmed" })
        .populate("event", "title startDate venue.city category")
        .select("event ticketType quantity totalAmount createdAt"),
      Booking.find({ user: userId })
        .populate("event", "title startDate venue.city")
        .select("event ticketType quantity totalAmount status createdAt")
        .sort({ createdAt: -1 })
        .limit(20),
    ]);

    // Calculate statistics
    const stats = {
      eventsCreated: createdEvents.length,
      eventsAttended: attendingEvents.length,
      totalBookings: bookingHistory.length,
      accountAge: calculateAccountAge(user.createdAt),
      lastActivity: user.updatedAt,
      verificationStatus: user.isVerified,
      accountStatus: user.blocked ? "blocked" : "active",
    };

    // Role-specific information
    if (user.role === "organizer") {
      const organizerStats = await getOrganizerStats(userId);
      stats.organizerMetrics = organizerStats;
    }

    if (user.role === "admin") {
      const adminStats = await getAdminStats(userId);
      stats.adminMetrics = adminStats;
    }

    // Financial summary
    const financialSummary = {
      totalSpent: user.totalSpent || 0,
      averageSpentPerEvent:
        attendingEvents.length > 0
          ? (user.totalSpent || 0) / attendingEvents.length
          : 0,
      lastPurchase:
        bookingHistory.length > 0 ? bookingHistory[0].createdAt : null,
      favoriteCategory: await getUserFavoriteCategory(userId),
    };

    userDetails = {
      ...userDetails,
      statistics: stats,
      financialSummary,
      createdEvents: createdEvents.slice(0, 5), // Recent 5 events
      recentBookings: bookingHistory.slice(0, 10), // Recent 10 bookings
      attendingEvents: attendingEvents.slice(0, 5), // Recent 5 attending
    };

    sendSuccess(res, "User details retrieved successfully", userDetails);
  } catch (error) {
    console.error("Get user details error:", error);
    sendError(res, 500, "Failed to retrieve user details", error.message);
  }
};

// Get all users with detailed information (Admin only)
const getAllUsersDetails = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return sendError(res, 403, "Admin access required");
    }

    const { page, limit, skip } = getPagination(req);
    const {
      role,
      status,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build query
    let query = {};

    if (role) {
      query.role = role;
    }

    if (status) {
      if (status === "blocked") {
        query.blocked = true;
      } else if (status === "active") {
        query.blocked = false;
      } else if (status === "verified") {
        query.isVerified = true;
      } else if (status === "unverified") {
        query.isVerified = false;
      }
    }

    if (search) {
      query.$or = [
        { firstName: new RegExp(search, "i") },
        { lastName: new RegExp(search, "i") },
        { email: new RegExp(search, "i") },
      ];
    }

    // Get users from all collections
    const users = await UserManager.getAllUsers(query, {
      skip,
      limit,
      sortBy,
      sortOrder,
    });

    // Get detailed information for each user
    const usersWithDetails = await Promise.all(
      users.map(async (user) => {
        const [eventsCreated, bookings] = await Promise.all([
          Event.countDocuments({ organizer: user._id }),
          Booking.countDocuments({ user: user._id, status: "confirmed" }),
        ]);

        return {
          ...((user.toObject && user.toObject()) || user),
          totalSpent: user.totalSpent || 0,
          statistics: {
            eventsCreated,
            eventsAttended: bookings,
            accountAge: calculateAccountAge(user.createdAt),
            lastActivity: user.updatedAt,
          },
        };
      })
    );

    const total = await UserManager.getTotalUsersCount(query);

    sendSuccess(res, "Users details retrieved successfully", usersWithDetails, {
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get all users details error:", error);
    sendError(res, 500, "Failed to retrieve users details", error.message);
  }
};

// Helper function to check if organizer can view attendee details
const checkOrganizerAttendeePermission = async (organizerId, userId) => {
  try {
    const organizerEvents = await Event.find({ organizer: organizerId }).select(
      "_id"
    );
    const eventIds = organizerEvents.map((event) => event._id);

    const attendeeBooking = await Booking.findOne({
      user: userId,
      event: { $in: eventIds },
      status: "confirmed",
    });

    return !!attendeeBooking;
  } catch (error) {
    console.error("Check organizer permission error:", error);
    return false;
  }
};

// Helper function to calculate account age
const calculateAccountAge = (createdAt) => {
  const now = new Date();
  const accountCreated = new Date(createdAt);
  const diffTime = Math.abs(now - accountCreated);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 30) {
    return `${diffDays} days`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months > 1 ? "s" : ""}`;
  } else {
    const years = Math.floor(diffDays / 365);
    return `${years} year${years > 1 ? "s" : ""}`;
  }
};

// Helper function to get organizer-specific stats
const getOrganizerStats = async (organizerId) => {
  try {
    const [
      totalEvents,
      approvedEvents,
      pendingEvents,
      totalAttendees,
      totalRevenue,
    ] = await Promise.all([
      Event.countDocuments({ organizer: organizerId }),
      Event.countDocuments({ organizer: organizerId, approved: true }),
      Event.countDocuments({ organizer: organizerId, approved: false }),
      Booking.countDocuments({
        event: {
          $in: await Event.find({ organizer: organizerId }).select("_id"),
        },
        status: "confirmed",
      }),
      Booking.aggregate([
        {
          $lookup: {
            from: "events",
            localField: "event",
            foreignField: "_id",
            as: "eventDetails",
          },
        },
        {
          $match: {
            "eventDetails.organizer": organizerId,
            status: "confirmed",
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$totalAmount" },
          },
        },
      ]),
    ]);

    return {
      totalEvents,
      approvedEvents,
      pendingEvents,
      rejectedEvents: totalEvents - approvedEvents - pendingEvents,
      totalAttendees,
      totalRevenue: totalRevenue[0]?.totalRevenue || 0,
      approvalRate: totalEvents > 0 ? (approvedEvents / totalEvents) * 100 : 0,
    };
  } catch (error) {
    console.error("Get organizer stats error:", error);
    return {};
  }
};

// Helper function to get admin-specific stats
const getAdminStats = async (adminId) => {
  try {
    // Get recent admin activities (this would require an activity log model)
    // For now, return basic admin info
    return {
      role: "admin",
      permissions: "full",
      lastLogin: new Date(), // This should come from the admin model
    };
  } catch (error) {
    console.error("Get admin stats error:", error);
    return {};
  }
};

// Helper function to get user's favorite event category
const getUserFavoriteCategory = async (userId) => {
  try {
    const bookings = await Booking.find({ user: userId, status: "confirmed" })
      .populate("event", "category")
      .select("event");

    const categoryCount = {};
    bookings.forEach((booking) => {
      if (booking.event && booking.event.category) {
        const category = booking.event.category;
        categoryCount[category] = (categoryCount[category] || 0) + 1;
      }
    });

    let favoriteCategory = "None";
    let maxCount = 0;
    Object.entries(categoryCount).forEach(([category, count]) => {
      if (count > maxCount) {
        maxCount = count;
        favoriteCategory = category;
      }
    });

    return favoriteCategory;
  } catch (error) {
    console.error("Get favorite category error:", error);
    return "None";
  }
};

// Get current user's full profile (for organizers and users)
const getUserProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    // Get comprehensive user details
    const userResult = await UserManager.findById(userId);
    if (!userResult) {
      return sendError(res, 404, "User not found");
    }

    const { user } = userResult;

    // Get additional statistics
    const [eventsCreated, bookings, lastBooking] = await Promise.all([
      Event.countDocuments({ organizer: userId }),
      Booking.countDocuments({ user: userId, status: "confirmed" }),
      Booking.findOne({ user: userId, status: "confirmed" })
        .sort({ createdAt: -1 })
        .populate("event", "title category"),
    ]);

    // Get purchase history with event details
    const purchaseHistory = await Booking.find({
      user: userId,
      status: "confirmed",
      totalAmount: { $gt: 0 },
    })
      .populate("event", "title category startDate")
      .sort({ createdAt: -1 })
      .limit(10);

    // Role-specific metrics
    let roleSpecificData = {};

    if (userRole === "organizer") {
      const organizerEvents = await Event.find({ organizer: userId });
      const totalRevenue = await Booking.aggregate([
        {
          $match: {
            event: { $in: organizerEvents.map((e) => e._id) },
            status: "confirmed",
          },
        },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]);

      roleSpecificData.organizerMetrics = {
        totalEventsCreated: eventsCreated,
        totalRevenue: totalRevenue[0]?.total || 0,
        averageEventAttendance:
          organizerEvents.length > 0
            ? (await Booking.countDocuments({
                event: { $in: organizerEvents.map((e) => e._id) },
                status: "confirmed",
              })) / organizerEvents.length
            : 0,
        pendingEvents: await Event.countDocuments({
          organizer: userId,
          status: "pending",
        }),
        approvedEvents: await Event.countDocuments({
          organizer: userId,
          status: "approved",
        }),
        recentEvents: organizerEvents.slice(0, 5).map((event) => ({
          id: event._id,
          title: event.title,
          status: event.status,
          startDate: event.startDate,
        })),
      };
    }

    if (userRole === "user") {
      const favoriteCategory = await getUserFavoriteCategory(userId);
      const upcomingBookings = await Booking.find({
        user: userId,
        status: "confirmed",
      })
        .populate("event", "title startDate venue")
        .sort({ "event.startDate": 1 })
        .limit(5);

      roleSpecificData.userMetrics = {
        totalEventsAttended: bookings,
        favoriteCategory,
        upcomingEvents: upcomingBookings.filter(
          (booking) => new Date(booking.event.startDate) > new Date()
        ).length,
        recentBookings: purchaseHistory.slice(0, 3),
      };
    }

    // Financial summary
    const financialSummary = {
      totalSpent: user.totalSpent || 0,
      averageSpentPerEvent:
        bookings > 0 ? (user.totalSpent || 0) / bookings : 0,
      lastPurchase: lastBooking
        ? {
            event: lastBooking.event?.title,
            amount: lastBooking.totalAmount,
            date: lastBooking.createdAt,
          }
        : null,
      favoriteCategory: await getUserFavoriteCategory(userId),
    };

    // Comprehensive profile data
    const profileData = {
      ...((user.toObject && user.toObject()) || user),
      totalSpent: user.totalSpent || 0,
      purchaseHistory: purchaseHistory.map((booking) => ({
        eventTitle: booking.event?.title,
        eventCategory: booking.event?.category,
        amount: booking.totalAmount,
        date: booking.createdAt,
        eventDate: booking.event?.startDate,
      })),
      statistics: {
        eventsCreated,
        eventsAttended: bookings,
        accountAge: calculateAccountAge(user.createdAt),
        lastActivity: user.updatedAt,
        verificationStatus: user.isVerified,
        accountStatus: user.blocked ? "blocked" : "active",
        ...roleSpecificData,
      },
      financialSummary,
      profileCompleteness: calculateProfileCompleteness(user),
      activitySummary: {
        totalBookings: bookings,
        lastBooking: lastBooking ? lastBooking.createdAt : null,
        joinDate: user.createdAt,
        lastLogin: user.lastLogin || null,
      },
    };

    // Remove sensitive information
    delete profileData.password;
    delete profileData.verificationToken;
    delete profileData.resetPasswordToken;

    sendSuccess(res, "Profile retrieved successfully", profileData);
  } catch (error) {
    console.error("Get user profile error:", error);
    sendError(res, 500, "Failed to retrieve profile", error.message);
  }
};

// Calculate profile completeness percentage
const calculateProfileCompleteness = (user) => {
  let completeness = 0;
  const totalFields = 10;

  if (user.firstName) completeness++;
  if (user.lastName) completeness++;
  if (user.email) completeness++;
  if (user.phone) completeness++;
  if (user.isVerified) completeness++;
  if (user.role === "organizer" && user.verified) completeness++;
  if (user.role === "organizer" && user.verificationDocuments?.length > 0)
    completeness++;
  if (user.notifications) completeness++;
  if (user.preferences || user.favoriteCategories?.length > 0) completeness++;
  if (user.role === "admin" && user.department) completeness++;

  return Math.round((completeness / totalFields) * 100);
};

module.exports = {
  getUserDetails,
  getAllUsersDetails,
  getUserProfile,
};
