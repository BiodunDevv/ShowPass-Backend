const express = require("express");
const router = express.Router();
const { requireAuth, isAdmin } = require("../middlewares/auth");
const {
  sendUniversalMessage,
  sendMessageToAllUsers,
  sendMessageToAllOrganizers,
  sendMessageToSpecificOrganizer,
  sendMessageToSpecificUser,
} = require("../controllers/messagingController");

// All messaging routes require admin authentication
router.use(requireAuth);
router.use(isAdmin);

// Send universal message to all users and organizers
router.post("/universal", sendUniversalMessage);

// Send message to all users only
router.post("/all-users", sendMessageToAllUsers);

// Send message to all organizers only
router.post("/all-organizers", sendMessageToAllOrganizers);

// Send message to specific organizer by ID
router.post("/organizer/:organizerId", sendMessageToSpecificOrganizer);

// Send message to specific user by ID
router.post("/user/:userId", sendMessageToSpecificUser);

module.exports = router;
