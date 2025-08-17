const express = require("express");
const router = express.Router();
const { requireAuth, hasRole } = require("../middlewares/auth");
const { sendSuccess, sendError } = require("../utils/helpers");
const UserManager = require("../utils/UserManager");
const Event = require("../models/Event");
const Booking = require("../models/Booking");

// Helper function for real-time account age calculation
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

// Helper function to calculate profile completeness
const calculateProfileCompleteness = (user) => {
  const requiredFields = ["firstName", "lastName", "email", "phone"];
  const optionalFields = ["bio", "website", "profilePicture"];

  let completed = 0;
  let total = requiredFields.length + optionalFields.length;

  requiredFields.forEach((field) => {
    if (user[field] && user[field].trim()) completed++;
  });

  optionalFields.forEach((field) => {
    if (user[field] && user[field].trim()) completed++;
  });

  return Math.round((completed / total) * 100);
};

// Helper function to get user's favorite category
const getUserFavoriteCategory = async (userId) => {
  try {
    const categoryStats = await Booking.aggregate([
      {
        $match: {
          user: userId,
          status: "confirmed",
        },
      },
      {
        $lookup: {
          from: "events",
          localField: "event",
          foreignField: "_id",
          as: "eventDetails",
        },
      },
      {
        $unwind: "$eventDetails",
      },
      {
        $group: {
          _id: "$eventDetails.category",
          count: { $sum: 1 },
          totalSpent: { $sum: "$totalAmount" },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $limit: 1,
      },
    ]);

    return categoryStats.length > 0 ? categoryStats[0]._id : "No preference";
  } catch (error) {
    return "No preference";
  }
};

// Route: Get organizer-specific profile
router.get(
  "/organizer/profile",
  requireAuth,
  hasRole("organizer"),
  async (req, res) => {
    try {
      const organizerId = req.user._id;

      // Get organizer details
      const organizerResult = await UserManager.findById(organizerId);
      if (!organizerResult) {
        return sendError(res, 404, "Organizer not found");
      }

      const { user: organizer } = organizerResult;

      // Get organizer-specific statistics
      const [
        totalEvents,
        pendingEvents,
        approvedEvents,
        rejectedEvents,
        totalBookings,
        totalRevenue,
      ] = await Promise.all([
        Event.countDocuments({ organizer: organizerId }),
        Event.countDocuments({ organizer: organizerId, status: "pending" }),
        Event.countDocuments({ organizer: organizerId, status: "approved" }),
        Event.countDocuments({ organizer: organizerId, status: "rejected" }),
        Booking.countDocuments({
          event: {
            $in: await Event.find({ organizer: organizerId }).distinct("_id"),
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
            $unwind: "$eventDetails",
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
              total: { $sum: "$totalAmount" },
            },
          },
        ]),
      ]);

      // Get recent events with actual booking counts
      const recentEventsData = await Event.find({ organizer: organizerId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("title status startDate category ticketTypes");

      // Calculate actual sold tickets for each event based on bookings
      const recentEventsWithBookings = await Promise.all(
        recentEventsData.map(async (event) => {
          const eventBookings = await Booking.countDocuments({
            event: event._id,
            status: "confirmed",
          });

          const totalTicketsForEvent =
            event.ticketTypes?.reduce(
              (total, ticket) => total + ticket.quantity,
              0
            ) || 0;

          return {
            id: event._id,
            title: event.title,
            status: event.status,
            startDate: event.startDate,
            category: event.category,
            totalTickets: totalTicketsForEvent,
            soldTickets: eventBookings, // Use actual booking count
            sellRate:
              totalTicketsForEvent > 0
                ? Math.round((eventBookings / totalTicketsForEvent) * 100)
                : 0,
          };
        })
      );

      // Calculate average tickets sold based on actual bookings
      const totalActualSales = recentEventsWithBookings.reduce(
        (sum, event) => sum + event.soldTickets,
        0
      );
      const averageTicketsSold =
        recentEventsWithBookings.length > 0
          ? Math.round(totalActualSales / recentEventsWithBookings.length)
          : 0;

      // Prepare organizer profile data
      const profileData = {
        id: organizer._id,
        firstName: organizer.firstName,
        lastName: organizer.lastName,
        email: organizer.email,
        phone: organizer.phone,
        profilePicture: organizer.profilePicture,
        bio: organizer.bio,
        website: organizer.website,
        socialLinks: organizer.socialLinks || {},
        businessInfo: organizer.businessInfo || {},
        isVerified: organizer.isVerified,
        role: organizer.role,
        createdAt: organizer.createdAt,
        accountAge: calculateAccountAge(organizer.createdAt),
        profileCompleteness: calculateProfileCompleteness(organizer),

        // Organizer-specific metrics
        organizerMetrics: {
          totalEvents,
          pendingEvents,
          approvedEvents,
          rejectedEvents,
          totalBookings,
          totalRevenue: totalRevenue[0]?.total || 0,
          averageTicketsSold: Math.round(averageTicketsSold),
          successRate:
            totalEvents > 0
              ? Math.round((approvedEvents / totalEvents) * 100)
              : 0,
        },

        recentEvents: recentEventsWithBookings,
      };

      // Remove sensitive information
      delete profileData.password;
      delete profileData.verificationToken;
      delete profileData.resetPasswordToken;

      sendSuccess(res, "Organizer profile retrieved successfully", profileData);
    } catch (error) {
      console.error("Get organizer profile error:", error);
      sendError(
        res,
        500,
        "Failed to retrieve organizer profile",
        error.message
      );
    }
  }
);

// Route: Get user-specific profile
router.get("/user/profile", requireAuth, hasRole("user"), async (req, res) => {
  try {
    const userId = req.user._id;

    // Get user details
    const userResult = await UserManager.findById(userId);
    if (!userResult) {
      return sendError(res, 404, "User not found");
    }

    const { user } = userResult;

    // Get user-specific statistics with corrected calculations
    const [
      totalBookings,
      checkedInEvents,
      upcomingBookings,
      pastBookings,
      favoriteCategory,
    ] = await Promise.all([
      Booking.countDocuments({ user: userId, status: "confirmed" }),
      Booking.countDocuments({
        user: userId,
        status: "confirmed",
        isCheckedIn: true,
      }),
      Booking.find({
        user: userId,
        status: "confirmed",
      })
        .populate("event", "title startDate venue category")
        .then((bookings) =>
          bookings.filter(
            (booking) => new Date(booking.event.startDate) > new Date()
          )
        ),
      Booking.find({
        user: userId,
        status: "confirmed",
      })
        .populate("event", "title startDate venue category")
        .then((bookings) =>
          bookings.filter(
            (booking) => new Date(booking.event.startDate) <= new Date()
          )
        ),
      getUserFavoriteCategory(userId),
    ]);

    // Calculate total spent correctly
    const spentCalculation = await Booking.aggregate([
      {
        $match: {
          user: userId,
          status: "confirmed",
        },
      },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: "$totalAmount" },
          totalWithFees: { $sum: "$finalAmount" },
        },
      },
    ]);

    const totalSpent =
      spentCalculation.length > 0 ? spentCalculation[0].totalSpent : 0;
    const totalWithFees =
      spentCalculation.length > 0 ? spentCalculation[0].totalWithFees : 0;

    // Get recent booking history
    const recentBookings = await Booking.find({
      user: userId,
      status: "confirmed",
    })
      .populate("event", "title category startDate venue")
      .sort({ createdAt: -1 })
      .limit(10);

    // Prepare user profile data
    const profileData = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      profilePicture: user.profilePicture,
      bio: user.bio,
      website: user.website,
      socialLinks: user.socialLinks || {},
      preferences: user.preferences || {},
      isVerified: user.isVerified,
      role: user.role,
      createdAt: user.createdAt,
      accountAge: calculateAccountAge(user.createdAt),
      profileCompleteness: calculateProfileCompleteness(user),

      // User-specific metrics
      userMetrics: {
        totalBookings,
        eventsAttended: checkedInEvents, // Only checked-in events
        upcomingEvents: upcomingBookings.length,
        pastEvents: pastBookings.length,
        totalSpent,
        totalWithFees,
        averageSpentPerEvent:
          totalBookings > 0 ? Math.round(totalSpent / totalBookings) : 0,
        favoriteCategory,
        attendanceRate:
          totalBookings > 0
            ? Math.round((checkedInEvents / totalBookings) * 100)
            : 0,
      },

      // Financial summary
      financialSummary: {
        totalSpent,
        totalWithFees,
        averageSpentPerEvent:
          totalBookings > 0 ? Math.round(totalSpent / totalBookings) : 0,
        savingsFromBookings: totalWithFees - totalSpent, // Difference between final amount and base amount
        lastPurchase:
          recentBookings.length > 0
            ? {
                event: recentBookings[0].event?.title,
                amount: recentBookings[0].totalAmount,
                date: recentBookings[0].createdAt,
              }
            : null,
      },

      // Recent activity
      recentBookings: recentBookings.slice(0, 5).map((booking) => ({
        id: booking._id,
        eventTitle: booking.event?.title,
        eventCategory: booking.event?.category,
        eventDate: booking.event?.startDate,
        venue: booking.event?.venue,
        amount: booking.totalAmount,
        bookingDate: booking.createdAt,
        isCheckedIn: booking.isCheckedIn || false,
        verificationCodesCount: booking.verificationCodes?.length || 0,
      })),

      upcomingEvents: upcomingBookings.slice(0, 5).map((booking) => ({
        id: booking._id,
        eventTitle: booking.event?.title,
        eventCategory: booking.event?.category,
        eventDate: booking.event?.startDate,
        venue: booking.event?.venue,
        daysUntilEvent: Math.ceil(
          (new Date(booking.event.startDate) - new Date()) /
            (1000 * 60 * 60 * 24)
        ),
      })),
    };

    // Remove sensitive information
    delete profileData.password;
    delete profileData.verificationToken;
    delete profileData.resetPasswordToken;

    sendSuccess(res, "User profile retrieved successfully", profileData);
  } catch (error) {
    console.error("Get user profile error:", error);
    sendError(res, 500, "Failed to retrieve user profile", error.message);
  }
});

// Route: Update organizer profile
router.put(
  "/organizer/profile",
  requireAuth,
  hasRole("organizer"),
  async (req, res) => {
    try {
      const organizerId = req.user._id;
      const updates = req.body;

      // Allowed fields for organizer profile update
      const allowedFields = [
        "firstName",
        "lastName",
        "phone",
        "bio",
        "website",
        "profilePicture",
        "socialLinks",
        "businessInfo",
      ];

      // Filter updates to only include allowed fields
      const filteredUpdates = {};
      Object.keys(updates).forEach((key) => {
        if (allowedFields.includes(key)) {
          filteredUpdates[key] = updates[key];
        }
      });

      if (Object.keys(filteredUpdates).length === 0) {
        return sendError(res, 400, "No valid fields provided for update");
      }

      // Update organizer profile
      const result = await UserManager.updateUser(organizerId, filteredUpdates);
      if (!result) {
        return sendError(res, 404, "Organizer not found");
      }

      sendSuccess(res, "Organizer profile updated successfully", {
        updatedFields: Object.keys(filteredUpdates),
        profileCompleteness: calculateProfileCompleteness(result.user),
      });
    } catch (error) {
      console.error("Update organizer profile error:", error);
      sendError(res, 500, "Failed to update organizer profile", error.message);
    }
  }
);

// Route: Update user profile
router.put("/user/profile", requireAuth, hasRole("user"), async (req, res) => {
  try {
    const userId = req.user._id;
    const updates = req.body;

    // Allowed fields for user profile update
    const allowedFields = [
      "firstName",
      "lastName",
      "phone",
      "bio",
      "website",
      "profilePicture",
      "socialLinks",
      "preferences",
    ];

    // Filter updates to only include allowed fields
    const filteredUpdates = {};
    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });

    if (Object.keys(filteredUpdates).length === 0) {
      return sendError(res, 400, "No valid fields provided for update");
    }

    // Update user profile
    const result = await UserManager.updateUser(userId, filteredUpdates);
    if (!result) {
      return sendError(res, 404, "User not found");
    }

    sendSuccess(res, "User profile updated successfully", {
      updatedFields: Object.keys(filteredUpdates),
      profileCompleteness: calculateProfileCompleteness(result.user),
    });
  } catch (error) {
    console.error("Update user profile error:", error);
    sendError(res, 500, "Failed to update user profile", error.message);
  }
});

// Route: Sync event ticket sales (utility route for fixing data)
router.post(
  "/sync-tickets/:eventId",
  requireAuth,
  hasRole("organizer"),
  async (req, res) => {
    try {
      const { eventId } = req.params;
      const organizerId = req.user._id;

      // Find event and verify ownership
      const event = await Event.findOne({
        _id: eventId,
        organizer: organizerId,
      });
      if (!event) {
        return sendError(res, 404, "Event not found or access denied");
      }

      // Sync sold tickets with actual bookings
      await event.syncSoldTickets();

      // Return updated event data
      const updatedEvent = await Event.findById(eventId);

      sendSuccess(res, "Event ticket sales synchronized successfully", {
        eventId: updatedEvent._id,
        title: updatedEvent.title,
        totalTickets: updatedEvent.totalTickets,
        ticketsSold: updatedEvent.ticketsSold,
        currentAttendees: updatedEvent.currentAttendees,
        ticketTypes: updatedEvent.ticketTypes.map((tt) => ({
          name: tt.name,
          quantity: tt.quantity,
          sold: tt.sold,
          available: tt.quantity - tt.sold,
        })),
      });
    } catch (error) {
      console.error("Sync tickets error:", error);
      sendError(res, 500, "Failed to sync ticket sales", error.message);
    }
  }
);

module.exports = router;
