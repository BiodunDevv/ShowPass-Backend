const mongoose = require("mongoose");

// Organizer Model - stored in 'organizers' collection
const organizerSchema = new mongoose.Schema(
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
      default: "organizer",
      immutable: true,
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
    verificationCode: String,
    verificationCodeExpires: Date,
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
    bio: {
      type: String,
      maxlength: 500,
    },
    website: String,
    socialLinks: {
      twitter: String,
      facebook: String,
      instagram: String,
      linkedin: String,
    },
    // Business information
    businessName: String,
    businessAddress: {
      street: String,
      city: String,
      state: String,
      country: String,
    },
    businessPhone: String,
    businessWebsite: String,
    businessType: {
      type: String,
      enum: ["individual", "company", "nonprofit", "government"],
      default: "individual",
    },
    // Account deletion tracking
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: Date,
    deletionReason: String,
    // UI preferences
    theme: {
      type: String,
      enum: ["light", "dark", "auto"],
      default: "light",
    },
    language: {
      type: String,
      default: "en",
    },
    timezone: {
      type: String,
      default: "UTC",
    },
    // Notification preferences
    notifications: {
      email: {
        type: Boolean,
        default: true,
      },
      push: {
        type: Boolean,
        default: true,
      },
      sms: {
        type: Boolean,
        default: false,
      },
      newEvents: {
        type: Boolean,
        default: true,
      },
      eventUpdates: {
        type: Boolean,
        default: true,
      },
      eventReminders: {
        type: Boolean,
        default: true,
      },
      promotions: {
        type: Boolean,
        default: false,
      },
      newsletter: {
        type: Boolean,
        default: false,
      },
      newBookings: {
        type: Boolean,
        default: true,
      },
      eventApproval: {
        type: Boolean,
        default: true,
      },
    },
    // Organizer preferences
    preferences: {
      autoAcceptBookings: {
        type: Boolean,
        default: false,
      },
      showProfile: {
        type: Boolean,
        default: true,
      },
      allowMessages: {
        type: Boolean,
        default: true,
      },
      requireEventApproval: {
        type: Boolean,
        default: true,
      },
      defaultEventPrivacy: {
        type: String,
        enum: ["public", "private"],
        default: "public",
      },
    },
    // Privacy settings
    privacy: {
      showEmail: {
        type: Boolean,
        default: false,
      },
      showPhone: {
        type: Boolean,
        default: false,
      },
      showBusinessInfo: {
        type: Boolean,
        default: true,
      },
      profileVisibility: {
        type: String,
        enum: ["public", "private"],
        default: "public",
      },
    },
    // Events created by organizer
    createdEvents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Event",
      },
    ],
    // Events organizer is attending (as attendee)
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
      eventApprovals: {
        type: Boolean,
        default: true,
      },
    },
    // Organizer-specific fields
    organizationInfo: {
      companyName: String,
      businessRegistration: String,
      website: String,
      socialMedia: {
        facebook: String,
        twitter: String,
        instagram: String,
        linkedin: String,
      },
    },
    bankDetails: {
      accountName: String,
      accountNumber: String,
      bankName: String,
      bankCode: String,
    },
    verified: {
      type: Boolean,
      default: true,
    },
    verificationDocuments: [String], // File paths
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalEventsCreated: {
      type: Number,
      default: 0,
    },
    totalTicketsSold: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: "organizers", // Explicit collection name
  }
);

// Hash password before saving
organizerSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  const bcrypt = require("bcryptjs");
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
organizerSchema.methods.comparePassword = async function (candidatePassword) {
  const bcrypt = require("bcryptjs");
  return await bcrypt.compare(candidatePassword, this.password);
};

// Virtual for full name
organizerSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Update stats when events are added
organizerSchema.methods.updateStats = async function () {
  const Event = require("./Event");
  const events = await Event.find({ organizer: this._id });

  this.totalEventsCreated = events.length;
  this.totalTicketsSold = events.reduce((total, event) => {
    return total + event.ticketsSold;
  }, 0);

  await this.save();
};

// Ensure virtual fields are serialized
organizerSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("Organizer", organizerSchema);
