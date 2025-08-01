const UserManager = require("../utils/UserManager");
const EmailService = require("../utils/emailService");
const { sendSuccess, sendError } = require("../utils/helpers");

// Send universal message to all users and organizers
const sendUniversalMessage = async (req, res) => {
  try {
    const { subject, message, includeUsers = true, includeOrganizers = true } = req.body;
    const admin = req.user;

    if (!subject || !message) {
      return sendError(res, 400, "Subject and message are required");
    }

    // Get all users based on preferences
    let recipients = [];
    
    if (includeUsers) {
      const users = await UserManager.getAllUsers({ role: "user" }, { limit: 1000 });
      recipients = [...recipients, ...users];
    }
    
    if (includeOrganizers) {
      const organizers = await UserManager.getAllUsers({ role: "organizer" }, { limit: 1000 });
      recipients = [...recipients, ...organizers];
    }

    if (recipients.length === 0) {
      return sendError(res, 400, "No recipients found");
    }

    // Send emails in batches to avoid overwhelming the email service
    const batchSize = 50;
    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      
      const emailPromises = batch.map(async (recipient) => {
        try {
          await EmailService.sendEmail(
            recipient.email,
            subject,
            "universal-message",
            {
              recipientName: `${recipient.firstName} ${recipient.lastName}`,
              subject,
              message,
              adminName: `${admin.firstName} ${admin.lastName}`,
              recipientRole: recipient.role,
              platformName: "ShowPass",
              currentYear: new Date().getFullYear()
            }
          );
          return { success: true, email: recipient.email };
        } catch (error) {
          console.error(`Failed to send email to ${recipient.email}:`, error);
          return { success: false, email: recipient.email, error: error.message };
        }
      });

      const results = await Promise.allSettled(emailPromises);
      
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value.success) {
          sentCount++;
        } else {
          failedCount++;
        }
      });

      // Small delay between batches
      if (i + batchSize < recipients.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    sendSuccess(res, "Universal message sent successfully", {
      totalRecipients: recipients.length,
      sentCount,
      failedCount,
      includeUsers,
      includeOrganizers,
      subject,
      sentBy: `${admin.firstName} ${admin.lastName}`,
      sentAt: new Date()
    });

  } catch (error) {
    console.error("Send universal message error:", error);
    sendError(res, 500, "Failed to send universal message", error.message);
  }
};

// Send message to all users only
const sendMessageToAllUsers = async (req, res) => {
  try {
    const { subject, message } = req.body;
    const admin = req.user;

    if (!subject || !message) {
      return sendError(res, 400, "Subject and message are required");
    }

    // Get all users
    const users = await UserManager.getAllUsers({ role: "user" }, { limit: 1000 });

    if (users.length === 0) {
      return sendError(res, 400, "No users found");
    }

    // Send emails
    let sentCount = 0;
    let failedCount = 0;

    const emailPromises = users.map(async (user) => {
      try {
        await EmailService.sendEmail(
          user.email,
          subject,
          "user-message",
          {
            userName: `${user.firstName} ${user.lastName}`,
            subject,
            message,
            adminName: `${admin.firstName} ${admin.lastName}`,
            platformName: "ShowPass",
            currentYear: new Date().getFullYear()
          }
        );
        sentCount++;
      } catch (error) {
        console.error(`Failed to send email to ${user.email}:`, error);
        failedCount++;
      }
    });

    await Promise.allSettled(emailPromises);

    sendSuccess(res, "Message sent to all users successfully", {
      totalUsers: users.length,
      sentCount,
      failedCount,
      subject,
      sentBy: `${admin.firstName} ${admin.lastName}`,
      sentAt: new Date()
    });

  } catch (error) {
    console.error("Send message to all users error:", error);
    sendError(res, 500, "Failed to send message to users", error.message);
  }
};

// Send message to all organizers only
const sendMessageToAllOrganizers = async (req, res) => {
  try {
    const { subject, message } = req.body;
    const admin = req.user;

    if (!subject || !message) {
      return sendError(res, 400, "Subject and message are required");
    }

    // Get all organizers
    const organizers = await UserManager.getAllUsers({ role: "organizer" }, { limit: 1000 });

    if (organizers.length === 0) {
      return sendError(res, 400, "No organizers found");
    }

    // Send emails
    let sentCount = 0;
    let failedCount = 0;

    const emailPromises = organizers.map(async (organizer) => {
      try {
        await EmailService.sendEmail(
          organizer.email,
          subject,
          "organizer-message",
          {
            organizerName: `${organizer.firstName} ${organizer.lastName}`,
            subject,
            message,
            adminName: `${admin.firstName} ${admin.lastName}`,
            platformName: "ShowPass",
            currentYear: new Date().getFullYear(),
            totalEvents: organizer.totalEventsCreated || 0
          }
        );
        sentCount++;
      } catch (error) {
        console.error(`Failed to send email to ${organizer.email}:`, error);
        failedCount++;
      }
    });

    await Promise.allSettled(emailPromises);

    sendSuccess(res, "Message sent to all organizers successfully", {
      totalOrganizers: organizers.length,
      sentCount,
      failedCount,
      subject,
      sentBy: `${admin.firstName} ${admin.lastName}`,
      sentAt: new Date()
    });

  } catch (error) {
    console.error("Send message to all organizers error:", error);
    sendError(res, 500, "Failed to send message to organizers", error.message);
  }
};

// Send message to specific organizer by ID
const sendMessageToSpecificOrganizer = async (req, res) => {
  try {
    const { organizerId } = req.params;
    const { subject, message } = req.body;
    const admin = req.user;

    if (!subject || !message) {
      return sendError(res, 400, "Subject and message are required");
    }

    // Find the specific organizer
    const organizerResult = await UserManager.findById(organizerId);
    
    if (!organizerResult) {
      return sendError(res, 404, "Organizer not found");
    }

    const { user: organizer } = organizerResult;

    if (organizer.role !== "organizer") {
      return sendError(res, 400, "The specified user is not an organizer");
    }

    // Send email to the specific organizer
    try {
      await EmailService.sendEmail(
        organizer.email,
        subject,
        "specific-organizer-message",
        {
          organizerName: `${organizer.firstName} ${organizer.lastName}`,
          subject,
          message,
          adminName: `${admin.firstName} ${admin.lastName}`,
          platformName: "ShowPass",
          currentYear: new Date().getFullYear(),
          totalEvents: organizer.totalEventsCreated || 0,
          isPersonalized: true
        }
      );

      sendSuccess(res, "Message sent to organizer successfully", {
        organizerId: organizer._id,
        organizerName: `${organizer.firstName} ${organizer.lastName}`,
        organizerEmail: organizer.email,
        subject,
        sentBy: `${admin.firstName} ${admin.lastName}`,
        sentAt: new Date()
      });

    } catch (emailError) {
      console.error(`Failed to send email to organizer ${organizer.email}:`, emailError);
      sendError(res, 500, "Failed to send email to organizer", emailError.message);
    }

  } catch (error) {
    console.error("Send message to specific organizer error:", error);
    sendError(res, 500, "Failed to send message to organizer", error.message);
  }
};

// Send message to specific user by ID
const sendMessageToSpecificUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { subject, message } = req.body;
    const admin = req.user;

    if (!subject || !message) {
      return sendError(res, 400, "Subject and message are required");
    }

    // Find the specific user
    const userResult = await UserManager.findById(userId);
    
    if (!userResult) {
      return sendError(res, 404, "User not found");
    }

    const { user } = userResult;

    if (user.role !== "user") {
      return sendError(res, 400, "The specified user is not a regular user");
    }

    // Send email to the specific user
    try {
      await EmailService.sendEmail(
        user.email,
        subject,
        "specific-user-message",
        {
          userName: `${user.firstName} ${user.lastName}`,
          subject,
          message,
          adminName: `${admin.firstName} ${admin.lastName}`,
          platformName: "ShowPass",
          currentYear: new Date().getFullYear(),
          isPersonalized: true
        }
      );

      sendSuccess(res, "Message sent to user successfully", {
        userId: user._id,
        userName: `${user.firstName} ${user.lastName}`,
        userEmail: user.email,
        subject,
        sentBy: `${admin.firstName} ${admin.lastName}`,
        sentAt: new Date()
      });

    } catch (emailError) {
      console.error(`Failed to send email to user ${user.email}:`, emailError);
      sendError(res, 500, "Failed to send email to user", emailError.message);
    }

  } catch (error) {
    console.error("Send message to specific user error:", error);
    sendError(res, 500, "Failed to send message to user", error.message);
  }
};

module.exports = {
  sendUniversalMessage,
  sendMessageToAllUsers,
  sendMessageToAllOrganizers,
  sendMessageToSpecificOrganizer,
  sendMessageToSpecificUser,
};
