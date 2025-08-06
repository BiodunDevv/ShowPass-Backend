const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const bodyParser = require("body-parser");

// Route imports
const authRoutes = require("./routes/authRoutes");
const eventRoutes = require("./routes/eventRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const adminRoutes = require("./routes/adminRoutes");
const refundRoutes = require("./routes/refundRoutes");
const userDetailsRoutes = require("./routes/userDetailsRoutes");
const articleRoutes = require("./routes/articleRoutes");
const messagingRoutes = require("./routes/messagingRoutes");
const userProfileRoutes = require("./routes/userProfileRoutes");

const app = express();

// Middleware
app.use(cors());
app.use(morgan("combined"));
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "10mb" }));

// Health check route
app.get("/", (req, res) => {
  res.json({
    message: "ShowPass Backend API is running! 🎟️",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      events: "/api/events",
      bookings: "/api/booking",
      payments: "/api/payment",
      admin: "/api/admin",
      refunds: "/api/refund",
      userDetails: "/api/user-details",
      articles: "/api/articles",
      messaging: "/api/messaging",
      userProfiles: "/api/profiles",
    },
  });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/booking", bookingRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/refund", refundRoutes);
app.use("/api/user-details", userDetailsRoutes);
app.use("/api/articles", articleRoutes);
app.use("/api/messaging", messagingRoutes);
app.use("/api/profiles", userProfileRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Something went wrong!",
    error:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Internal server error",
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

module.exports = app;
