const mongoose = require("mongoose");

// Admin Model - stored in 'admins' collection
const adminSchema = new mongoose.Schema(
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
    role: {
      type: String,
      default: "admin",
      immutable: true,
    },
    isVerified: {
      type: Boolean,
      default: true, // Admins are verified by default
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
    // Events approved by admin
    approvedEvents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Event",
      },
    ],
    // Events admin is attending (as attendee)
    attendingEvents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Event",
      },
    ],
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
      newEventReviews: {
        type: Boolean,
        default: true,
      },
      systemAlerts: {
        type: Boolean,
        default: true,
      },
    },
    // Admin-specific fields
    permissions: {
      canApproveEvents: {
        type: Boolean,
        default: true,
      },
      canManageUsers: {
        type: Boolean,
        default: true,
      },
      canManagePayments: {
        type: Boolean,
        default: true,
      },
      canViewAnalytics: {
        type: Boolean,
        default: true,
      },
      canManageSettings: {
        type: Boolean,
        default: false, // Only super admin
      },
    },
    isSuperAdmin: {
      type: Boolean,
      default: false,
    },
    department: {
      type: String,
      enum: ["events", "payments", "support", "marketing", "general"],
      default: "general",
    },
    lastLogin: Date,
    loginHistory: [
      {
        ip: String,
        userAgent: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Admin activity tracking
    activityLog: [
      {
        action: String,
        targetType: String, // 'event', 'user', 'booking', etc.
        targetId: mongoose.Schema.Types.ObjectId,
        details: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    totalEventsApproved: {
      type: Number,
      default: 0,
    },
    totalUsersManaged: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: "admins", // Explicit collection name
  }
);

// Hash password before saving
adminSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  const bcrypt = require("bcryptjs");
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
adminSchema.methods.comparePassword = async function (candidatePassword) {
  const bcrypt = require("bcryptjs");
  return await bcrypt.compare(candidatePassword, this.password);
};

// Virtual for full name
adminSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Log admin activity
adminSchema.methods.logActivity = async function (
  action,
  targetType,
  targetId,
  details
) {
  this.activityLog.push({
    action,
    targetType,
    targetId,
    details,
  });

  // Keep only last 100 activity logs
  if (this.activityLog.length > 100) {
    this.activityLog = this.activityLog.slice(-100);
  }

  await this.save();
};

// Update admin stats
adminSchema.methods.updateStats = async function () {
  const Event = require("./Event");
  const events = await Event.find({ approvedBy: this._id });
  this.totalEventsApproved = events.length;
  await this.save();
};

// Ensure virtual fields are serialized
adminSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("Admin", adminSchema);
