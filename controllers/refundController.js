const RefundRequest = require("../models/RefundRequest");
const Booking = require("../models/Booking");
const Event = require("../models/Event");
const User = require("../models/User");
const { sendSuccess, sendError, getPagination } = require("../utils/helpers");
const { initiateRefund } = require("../utils/paystack");
const { sendRefundConfirmation } = require("../utils/emailService");

// Create refund request
const createRefundRequest = async (req, res) => {
  try {
    const { bookingId, reason, description } = req.body;

    const booking = await Booking.findById(bookingId).populate(
      "event",
      "title startDate organizer"
    );

    if (!booking) {
      return sendError(res, 404, "Booking not found");
    }

    // Check if user owns the booking
    if (booking.user.toString() !== req.user._id.toString()) {
      return sendError(
        res,
        403,
        "You can only request refunds for your own bookings"
      );
    }

    if (booking.status !== "confirmed") {
      return sendError(
        res,
        400,
        "Only confirmed bookings are eligible for refunds"
      );
    }

    if (booking.isCheckedIn) {
      return sendError(
        res,
        400,
        "Cannot request refund after checking in to the event"
      );
    }

    // Check if refund request already exists
    const existingRefund = await RefundRequest.findOne({
      booking: bookingId,
      status: { $in: ["pending", "approved"] },
    });

    if (existingRefund) {
      return sendError(
        res,
        400,
        "Refund request already exists for this booking"
      );
    }

    // Calculate refund amount (deduct processing fee if applicable)
    const processingFeePercent = 2.5; // 2.5% processing fee
    const processingFee = (booking.finalAmount * processingFeePercent) / 100;
    const finalRefundAmount = Math.max(0, booking.finalAmount - processingFee);

    // Determine priority based on event date
    const hoursUntilEvent =
      (new Date(booking.event.startDate) - new Date()) / (1000 * 60 * 60);
    let priority = "medium";

    if (hoursUntilEvent < 24) {
      priority = "urgent";
    } else if (hoursUntilEvent < 72) {
      priority = "high";
    }

    const refundRequest = new RefundRequest({
      booking: bookingId,
      user: req.user._id,
      event: booking.event._id,
      reason,
      description,
      refundAmount: booking.finalAmount,
      processingFee,
      finalRefundAmount,
      priority,
    });

    await refundRequest.save();
    await refundRequest.populate([
      { path: "booking", select: "paymentReference ticketType quantity" },
      { path: "event", select: "title startDate" },
    ]);

    sendSuccess(
      res,
      "Refund request submitted successfully. It will be reviewed within 2-3 business days.",
      refundRequest
    );
  } catch (error) {
    console.error("Create refund request error:", error);
    sendError(res, 500, "Failed to create refund request", error.message);
  }
};

// Get user's refund requests
const getUserRefundRequests = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req);
    const { status } = req.query;

    let query = { user: req.user._id };

    if (status) {
      query.status = status;
    }

    const refundRequests = await RefundRequest.find(query)
      .populate("booking", "paymentReference ticketType quantity finalAmount")
      .populate("event", "title startDate venue")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await RefundRequest.countDocuments(query);

    sendSuccess(res, "Refund requests retrieved successfully", refundRequests, {
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get user refund requests error:", error);
    sendError(res, 500, "Failed to retrieve refund requests", error.message);
  }
};

// Get refund request by ID
const getRefundRequestById = async (req, res) => {
  try {
    const { id } = req.params;

    const refundRequest = await RefundRequest.findById(id)
      .populate("user", "firstName lastName email")
      .populate(
        "booking",
        "paymentReference ticketType quantity finalAmount paystackReference"
      )
      .populate("event", "title startDate venue organizer")
      .populate("resolvedBy", "firstName lastName email role");

    if (!refundRequest) {
      return sendError(res, 404, "Refund request not found");
    }

    // Check if user owns the refund request or is admin/organizer
    const isOwner =
      refundRequest.user._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === "admin";
    const isOrganizer =
      req.user.role === "organizer" &&
      refundRequest.event.organizer.toString() === req.user._id.toString();

    if (!isOwner && !isAdmin && !isOrganizer) {
      return sendError(res, 403, "Access denied");
    }

    sendSuccess(res, "Refund request retrieved successfully", refundRequest);
  } catch (error) {
    console.error("Get refund request error:", error);
    sendError(res, 500, "Failed to retrieve refund request", error.message);
  }
};

// Cancel refund request (user only)
const cancelRefundRequest = async (req, res) => {
  try {
    const { id } = req.params;

    const refundRequest = await RefundRequest.findById(id);
    if (!refundRequest) {
      return sendError(res, 404, "Refund request not found");
    }

    // Check if user owns the refund request
    if (refundRequest.user.toString() !== req.user._id.toString()) {
      return sendError(
        res,
        403,
        "You can only cancel your own refund requests"
      );
    }

    if (refundRequest.status !== "pending") {
      return sendError(
        res,
        400,
        "Only pending refund requests can be cancelled"
      );
    }

    refundRequest.status = "rejected";
    refundRequest.adminResponse = "Cancelled by user";
    refundRequest.resolvedBy = req.user._id;
    refundRequest.resolvedAt = new Date();

    await refundRequest.save();

    sendSuccess(res, "Refund request cancelled successfully");
  } catch (error) {
    console.error("Cancel refund request error:", error);
    sendError(res, 500, "Failed to cancel refund request", error.message);
  }
};

// Admin: Get all refund requests
const getAllRefundRequests = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req);
    const {
      status,
      priority,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    let query = {};

    if (status) {
      query.status = status;
    }

    if (priority) {
      query.priority = priority;
    }

    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    const refundRequests = await RefundRequest.find(query)
      .populate("user", "firstName lastName email")
      .populate("booking", "paymentReference ticketType quantity finalAmount")
      .populate("event", "title startDate organizer")
      .populate("resolvedBy", "firstName lastName email role")
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await RefundRequest.countDocuments(query);

    // Get statistics
    const stats = await RefundRequest.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$finalRefundAmount" },
        },
      },
    ]);

    sendSuccess(res, "Refund requests retrieved successfully", refundRequests, {
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      stats,
    });
  } catch (error) {
    console.error("Get all refund requests error:", error);
    sendError(res, 500, "Failed to retrieve refund requests", error.message);
  }
};

// Admin: Resolve refund request
const resolveRefundRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminResponse } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return sendError(res, 400, "Status must be either approved or rejected");
    }

    const refundRequest = await RefundRequest.findById(id)
      .populate("user")
      .populate("booking")
      .populate("event");

    if (!refundRequest) {
      return sendError(res, 404, "Refund request not found");
    }

    if (refundRequest.status !== "pending") {
      return sendError(
        res,
        400,
        "Only pending refund requests can be resolved"
      );
    }

    refundRequest.status = status;
    refundRequest.adminResponse = adminResponse;
    refundRequest.resolvedBy = req.user._id;
    refundRequest.resolvedAt = new Date();

    if (status === "approved") {
      // Process refund with Paystack
      try {
        const refundResult = await initiateRefund(
          refundRequest.booking.paystackReference,
          refundRequest.finalRefundAmount,
          `Refund approved: ${refundRequest.reason}`
        );

        if (refundResult.success) {
          refundRequest.paystackRefundId = refundResult.data.id;
          refundRequest.status = "processed";
          refundRequest.refundProcessedAt = new Date();

          // Update booking status
          const booking = await Booking.findById(refundRequest.booking._id);
          booking.status = "refunded";
          booking.paymentStatus = "refunded";
          booking.refundAmount = refundRequest.finalRefundAmount;
          booking.refundedAt = new Date();
          await booking.save();

          // Update event attendance
          const event = await Event.findById(refundRequest.event._id);
          event.currentAttendees -= booking.quantity;

          const ticketType = event.ticketTypes.find(
            (tt) => tt.name === booking.ticketType
          );
          if (ticketType) {
            ticketType.sold -= booking.quantity;
          }

          await event.save();

          // Send confirmation email
          try {
            await sendRefundConfirmation(
              refundRequest.user,
              refundRequest,
              booking,
              refundRequest.event
            );
          } catch (emailError) {
            console.error("Refund email failed:", emailError);
          }
        } else {
          return sendError(
            res,
            400,
            "Failed to process refund with payment provider"
          );
        }
      } catch (refundError) {
        console.error("Refund processing error:", refundError);
        return sendError(res, 500, "Failed to process refund");
      }
    }

    await refundRequest.save();

    sendSuccess(res, `Refund request ${status} successfully`, refundRequest);
  } catch (error) {
    console.error("Resolve refund request error:", error);
    sendError(res, 500, "Failed to resolve refund request", error.message);
  }
};

module.exports = {
  createRefundRequest,
  getUserRefundRequests,
  getRefundRequestById,
  cancelRefundRequest,
  getAllRefundRequests,
  resolveRefundRequest,
};
