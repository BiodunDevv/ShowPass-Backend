const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middlewares/auth");
const {
  getUserDetails,
  getAllUsersDetails,
  getUserProfile,
} = require("../controllers/userDetailsController");

// Get current user's full profile
router.get("/profile", requireAuth, getUserProfile);

// Get all users with details (Admin only)
router.get("/", requireAuth, getAllUsersDetails);

// Get detailed user information
router.get("/:userId", requireAuth, getUserDetails);

module.exports = router;
