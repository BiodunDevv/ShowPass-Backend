const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RegularUser",
      required: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    ticketType: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    platformFee: {
      type: Number,
      default: 0,
    },
    vat: {
      type: Number,
      default: 0,
    },
    finalAmount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "refunded", "used"],
      default: "confirmed", // Default to confirmed since payment is handled on frontend
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "paid", // Default to paid since payment is handled on frontend
    },
    paymentReference: {
      type: String,
      unique: true,
    },
    frontendPaymentId: String, // Store frontend payment transaction ID
    qrCode: String,
    qrCodeImage: String,
    individualQRs: [
      {
        ticketNumber: Number,
        reference: String,
        attendee: {
          name: String,
          email: String,
          phone: String,
        },
        qrCodeImage: String,
        hash: String,
        isUsed: {
          type: Boolean,
          default: false,
        },
        checkInTime: Date,
        checkedInBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Organizer",
        },
      },
    ],
    attendeeInfo: [
      {
        name: String,
        email: String,
        phone: String,
      },
    ],
    checkInTime: Date,
    isCheckedIn: {
      type: Boolean,
      default: false,
    },
    checkedInBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organizer",
    },
    refundReason: String,
    refundAmount: Number,
    refundedAt: Date,
    cancelledAt: Date,
    notes: String,
  },
  {
    timestamps: true,
  }
);

// Generate unique booking reference
bookingSchema.pre("save", function (next) {
  if (!this.paymentReference) {
    this.paymentReference = `SP${Date.now()}${Math.random()
      .toString(36)
      .substr(2, 5)
      .toUpperCase()}`;
  }
  next();
});

// Virtual for booking status display
bookingSchema.virtual("statusDisplay").get(function () {
  const statusMap = {
    pending: "Payment Pending",
    confirmed: "Confirmed",
    cancelled: "Cancelled",
    refunded: "Refunded",
    used: "Attended",
  };
  return statusMap[this.status] || this.status;
});

// Check if booking can be cancelled
bookingSchema.virtual("canCancel").get(function () {
  if (this.status !== "confirmed") return false;

  // Check if event exists and has startDate
  if (!this.event || !this.event.startDate) return false;

  // Can cancel up to 24 hours before event
  const eventDate = new Date(this.event.startDate);
  const now = new Date();
  const hoursUntilEvent = (eventDate - now) / (1000 * 60 * 60);

  return hoursUntilEvent > 24;
});

// Ensure virtual fields are serialized
bookingSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("Booking", bookingSchema);
