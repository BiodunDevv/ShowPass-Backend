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
      default: false,
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
