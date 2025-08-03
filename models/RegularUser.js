const mongoose = require("mongoose");

// Regular User Model - stored in 'regularusers' collection
const regularUserSchema = new mongoose.Schema(
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
      default: "user",
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
    // Events user is attending
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
    },
    // User-specific fields
    preferences: {
      favoriteCategories: [String],
      eventNotificationRadius: {
        type: Number,
        default: 50, // km
      },
    },
  },
  {
    timestamps: true,
    collection: "regularusers", // Explicit collection name
  }
);

// Hash password before saving
regularUserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  const bcrypt = require("bcryptjs");
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
regularUserSchema.methods.comparePassword = async function (candidatePassword) {
  const bcrypt = require("bcryptjs");
  return await bcrypt.compare(candidatePassword, this.password);
};

// Virtual for full name
regularUserSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Ensure virtual fields are serialized
regularUserSchema.set("toJSON", { virtuals: true });

module.exports = mongoose.model("RegularUser", regularUserSchema);
