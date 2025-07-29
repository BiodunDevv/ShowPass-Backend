const Booking = require("../models/Booking");
const Event = require("../models/Event");
const {
  initializePayment,
  verifyPayment,
  validateWebhookSignature,
} = require("../utils/paystack");
const { sendSuccess, sendError } = require("../utils/helpers");

// Initialize payment with Paystack
const initiatePayment = async (req, res) => {
  try {
    const { bookingId } = req.body;

    const booking = await Booking.findById(bookingId)
      .populate("user", "firstName lastName email")
      .populate("event", "title");

    if (!booking) {
      return sendError(res, 404, "Booking not found");
    }

    // Check if user owns the booking
    if (booking.user._id.toString() !== req.user._id.toString()) {
      return sendError(res, 403, "Access denied");
    }

    if (booking.status === "confirmed") {
      return sendError(res, 400, "Booking already confirmed");
    }

    if (booking.status === "cancelled") {
      return sendError(res, 400, "Cannot pay for cancelled booking");
    }

    // Initialize payment with Paystack
    const paymentData = await initializePayment(
      booking.user.email,
      booking.finalAmount,
      {
        bookingId: booking._id.toString(),
        eventId: booking.event._id.toString(),
        userId: booking.user._id.toString(),
        ticketType: booking.ticketType,
        quantity: booking.quantity,
      }
    );

    if (!paymentData.success) {
      return sendError(res, 400, paymentData.message);
    }

    // Update booking with payment reference
    booking.paymentReference = paymentData.reference;
    await booking.save();

    sendSuccess(res, "Payment initialized successfully", {
      authorization_url: paymentData.data.authorization_url,
      access_code: paymentData.data.access_code,
      reference: paymentData.reference,
      amount: booking.finalAmount,
      booking: booking,
    });
  } catch (error) {
    console.error("Payment initialization error:", error);
    sendError(res, 500, "Failed to initialize payment", error.message);
  }
};

// Verify payment callback
const verifyPaymentCallback = async (req, res) => {
  try {
    const { reference } = req.query;

    if (!reference) {
      return sendError(res, 400, "Payment reference is required");
    }

    const paymentData = await verifyPayment(reference);

    if (!paymentData.success) {
      return sendError(res, 400, paymentData.message);
    }

    const payment = paymentData.data;

    if (payment.status !== "success") {
      return sendError(res, 400, "Payment verification failed");
    }

    // Find booking by reference
    const booking = await Booking.findOne({ paymentReference: reference })
      .populate("user")
      .populate("event");

    if (!booking) {
      return sendError(res, 404, "Booking not found");
    }

    // Confirm booking payment
    await require("./bookingController").confirmBookingPayment(
      {
        body: {
          bookingId: booking._id,
          paymentReference: reference,
          paystackReference: payment.reference,
        },
      },
      res
    );
  } catch (error) {
    console.error("Payment verification error:", error);
    sendError(res, 500, "Payment verification failed", error.message);
  }
};

// Paystack webhook handler
const handleWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-paystack-signature"];
    const payload = req.body;

    // Validate webhook signature
    if (!validateWebhookSignature(payload, signature)) {
      return res.status(400).json({ error: "Invalid signature" });
    }

    const { event, data } = payload;

    switch (event) {
      case "charge.success":
        await handleSuccessfulPayment(data);
        break;

      case "charge.failed":
        await handleFailedPayment(data);
        break;

      case "refund.processed":
        await handleRefundProcessed(data);
        break;

      default:
        console.log(`Unhandled webhook event: ${event}`);
    }

    res.status(200).json({ status: "success" });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
};

// Handle successful payment
const handleSuccessfulPayment = async (data) => {
  try {
    const { reference, metadata } = data;

    const booking = await Booking.findById(metadata.bookingId)
      .populate("user")
      .populate("event");

    if (!booking) {
      console.error(
        "Booking not found for successful payment:",
        metadata.bookingId
      );
      return;
    }

    if (booking.status === "confirmed") {
      console.log("Booking already confirmed:", booking._id);
      return;
    }

    // Use the booking controller method
    const mockRes = {
      status: () => mockRes,
      json: (data) => console.log("Payment confirmation result:", data),
    };

    await require("./bookingController").confirmBookingPayment(
      {
        body: {
          bookingId: booking._id,
          paymentReference: reference,
          paystackReference: data.reference,
        },
      },
      mockRes
    );
  } catch (error) {
    console.error("Handle successful payment error:", error);
  }
};

// Handle failed payment
const handleFailedPayment = async (data) => {
  try {
    const { reference, metadata } = data;

    const booking = await Booking.findById(metadata.bookingId);
    if (booking) {
      booking.paymentStatus = "failed";
      await booking.save();
      console.log("Payment failed for booking:", booking._id);
    }
  } catch (error) {
    console.error("Handle failed payment error:", error);
  }
};

// Handle refund processed
const handleRefundProcessed = async (data) => {
  try {
    const { reference } = data;

    const booking = await Booking.findOne({ paystackReference: reference });
    if (booking) {
      booking.status = "refunded";
      booking.paymentStatus = "refunded";
      booking.refundedAt = new Date();
      await booking.save();
      console.log("Refund processed for booking:", booking._id);
    }
  } catch (error) {
    console.error("Handle refund processed error:", error);
  }
};

// Get payment status
const getPaymentStatus = async (req, res) => {
  try {
    const { reference } = req.params;

    const paymentData = await verifyPayment(reference);

    if (!paymentData.success) {
      return sendError(res, 400, paymentData.message);
    }

    sendSuccess(res, "Payment status retrieved successfully", paymentData.data);
  } catch (error) {
    console.error("Get payment status error:", error);
    sendError(res, 500, "Failed to get payment status", error.message);
  }
};

// Get user's payment history
const getPaymentHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const bookings = await Booking.find({
      user: req.user._id,
      paymentStatus: { $in: ["paid", "refunded"] },
    })
      .populate("event", "title startDate venue")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Booking.countDocuments({
      user: req.user._id,
      paymentStatus: { $in: ["paid", "refunded"] },
    });

    const payments = bookings.map((booking) => ({
      _id: booking._id,
      event: booking.event,
      amount: booking.finalAmount,
      paymentStatus: booking.paymentStatus,
      paymentReference: booking.paymentReference,
      createdAt: booking.createdAt,
      refundedAt: booking.refundedAt,
    }));

    sendSuccess(res, "Payment history retrieved successfully", payments, {
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get payment history error:", error);
    sendError(res, 500, "Failed to retrieve payment history", error.message);
  }
};

module.exports = {
  initiatePayment,
  verifyPaymentCallback,
  handleWebhook,
  getPaymentStatus,
  getPaymentHistory,
};
