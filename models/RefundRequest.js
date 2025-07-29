const mongoose = require("mongoose");

const refundRequestSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
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
    reason: {
      type: String,
      required: [true, "Refund reason is required"],
      enum: [
        "Event cancelled by organizer",
        "Unable to attend",
        "Duplicate booking",
        "Event details changed significantly",
        "Medical emergency",
        "Travel restrictions",
        "Other",
      ],
    },
    description: {
      type: String,
      required: [true, "Please provide more details about your refund request"],
    },
    refundAmount: {
      type: Number,
      required: true,
    },
    processingFee: {
      type: Number,
      default: 0,
    },
    finalRefundAmount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "processed"],
      default: "pending",
    },
    adminResponse: String,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    resolvedAt: Date,
    paystackRefundId: String,
    refundProcessedAt: Date,
    attachments: [String], // For supporting documents
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
  },
  {
    timestamps: true,
  }
);

// Virtual for days since request
refundRequestSchema.virtual("daysSinceRequest").get(function () {
  const now = new Date();
  const created = new Date(this.createdAt);
  const diffTime = Math.abs(now - created);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for status display
refundRequestSchema.virtual("statusDisplay").get(function () {
  const statusMap = {
    pending: "Under Review",
    approved: "Approved - Processing",
    rejected: "Rejected",
    processed: "Refund Completed",
  };
  return statusMap[this.status] || this.status;
});

// Ensure virtual fields are serialized
refundRequestSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("RefundRequest", refundRequestSchema);
