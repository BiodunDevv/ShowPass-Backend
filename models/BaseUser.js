const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Base user schema with common fields
const baseUserSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    blocked: {
      type: Boolean,
      default: false,
    },
    verificationToken: String,
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    profileImage: String,
    phone: String,
    dateOfBirth: Date,
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
    },
    // Notification preferences
    notifications: {
      email: {
        type: Boolean,
        default: true,
      },
      newEvents: {
        type: Boolean,
        default: true,
      },
      eventUpdates: {
        type: Boolean,
        default: true,
      },
    },
    // Financial tracking
    totalSpent: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Purchase history for detailed tracking
    purchaseHistory: [
      {
        eventId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Event",
        },
        eventTitle: String,
        amount: Number,
        ticketType: String,
        quantity: Number,
        date: {
          type: Date,
          default: Date.now,
        },
        status: {
          type: String,
          enum: ["completed", "refunded", "cancelled"],
          default: "completed",
        },
      },
    ],
  },
  {
    timestamps: true,
    discriminatorKey: "userType", // This will help with inheritance
  }
);

// Hash password before saving
baseUserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
baseUserSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Virtual for full name
baseUserSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Ensure virtual fields are serialized
baseUserSchema.set("toJSON", { virtuals: true });

module.exports = baseUserSchema;
