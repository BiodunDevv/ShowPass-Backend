const express = require("express");
const router = express.Router();
const eventController = require("../controllers/eventController");
const {
  requireAuth,
  isOrganizer,
  optionalAuth,
} = require("../middlewares/auth");
const {
  validateEvent,
  validateObjectId,
} = require("../middlewares/validation");
const { param } = require("express-validator");

// @route   GET /api/events
// @desc    Get all public events with filtering and pagination
// @access  Public
router.get("/", optionalAuth, eventController.getEvents);

// @route   GET /api/events/categories
// @desc    Get all event categories
// @access  Public
router.get("/categories", eventController.getEventCategories);

// @route   POST /api/events
// @desc    Create new event
// @access  Private (Organizer/Admin)
router.post(
  "/",
  requireAuth,
  isOrganizer,
  validateEvent,
  eventController.createEvent
);

// @route   GET /api/events/organizer
// @desc    Get organizer's events
// @access  Private (Organizer/Admin)
router.get(
  "/organizer",
  requireAuth,
  isOrganizer,
  eventController.getOrganizerEvents
);

// @route   GET /api/events/:id
// @desc    Get single event by ID
// @access  Public
router.get(
  "/:id",
  validateObjectId(param("id")),
  optionalAuth,
  eventController.getEventById
);

// @route   PUT /api/events/:id
// @desc    Update event
// @access  Private (Organizer/Admin - Own events only)
router.put(
  "/:id",
  validateObjectId(param("id")),
  requireAuth,
  isOrganizer,
  eventController.updateEvent
);

// @route   DELETE /api/events/:id
// @desc    Delete event
// @access  Private (Organizer/Admin - Own events only)
router.delete(
  "/:id",
  validateObjectId(param("id")),
  requireAuth,
  isOrganizer,
  eventController.deleteEvent
);

// @route   GET /api/events/:id/attendees
// @desc    Get event attendees
// @access  Private (Organizer/Admin - Own events only)
router.get(
  "/:id/attendees",
  validateObjectId(param("id")),
  requireAuth,
  isOrganizer,
  eventController.getEventAttendees
);

module.exports = router;
