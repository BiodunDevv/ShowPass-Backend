const mongoose = require("mongoose");

const ticketTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    enum: ["VIP", "Regular", "Premium", "Standard", "Early Bird"],
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
  },
  sold: {
    type: Number,
    default: 0,
  },
  description: String,
  benefits: [String],
});

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Event title is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Event description is required"],
    },
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    category: {
      type: String,
      required: true,
      enum: [
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
      ],
    },
    venue: {
      name: {
        type: String,
        required: true,
      },
      address: {
        type: String,
        required: true,
      },
      city: {
        type: String,
        required: true,
      },
      state: {
        type: String,
        required: true,
      },
      coordinates: {
        latitude: Number,
        longitude: Number,
      },
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
    },
    startTime: {
      type: String,
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    ticketTypes: [ticketTypeSchema],
    images: [String],
    approved: {
      type: Boolean,
      default: false,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: Date,
    status: {
      type: String,
      enum: [
        "draft",
        "pending",
        "approved",
        "rejected",
        "cancelled",
        "completed",
      ],
      default: "pending",
    },
    rejectionReason: String,
    featured: {
      type: Boolean,
      default: false,
    },
    tags: [String],
    maxAttendees: Number,
    currentAttendees: {
      type: Number,
      default: 0,
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    requiresApproval: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual for total tickets
eventSchema.virtual("totalTickets").get(function () {
  return this.ticketTypes.reduce((total, ticket) => total + ticket.quantity, 0);
});

// Virtual for tickets sold
eventSchema.virtual("ticketsSold").get(function () {
  return this.ticketTypes.reduce((total, ticket) => total + ticket.sold, 0);
});

// Virtual for revenue
eventSchema.virtual("totalRevenue").get(function () {
  return this.ticketTypes.reduce(
    (total, ticket) => total + ticket.sold * ticket.price,
    0
  );
});

// Check if event is upcoming
eventSchema.virtual("isUpcoming").get(function () {
  return new Date() < new Date(this.startDate);
});

// Check if event is ongoing
eventSchema.virtual("isOngoing").get(function () {
  const now = new Date();
  return now >= new Date(this.startDate) && now <= new Date(this.endDate);
});

// Ensure virtual fields are serialized
eventSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("Event", eventSchema);
