const nodemailer = require("nodemailer");
const { formatCurrency } = require("./helpers");
const { loadTemplate, compileTemplate } = require("./templateLoader");

// Create transporter with better error handling
const createTransporter = () => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // Fixed: using EMAIL_PASS instead of EMAIL_PASSWORD
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    // Test connection
    transporter.verify((error, success) => {
      if (error) {
        console.log("❌ Email configuration error:", error);
      } else {
        console.log("✅ Email server is ready to send messages");
      }
    });

    return transporter;
  } catch (error) {
    console.error("❌ Error creating email transporter:", error);
    return null;
  }
};

const transporter = createTransporter();

// Generic send email function for custom templates and messages
const sendEmail = async (to, subject, templateName, templateData = {}) => {
  try {
    if (!transporter) {
      throw new Error("Email transporter not available");
    }

    const template = loadTemplate(templateName);
    const templateDataWithDefaults = {
      platformName: "ShowPass",
      currentYear: new Date().getFullYear(),
      ...templateData,
    };

    const mailOptions = {
      from: "ShowPass <noreply@showpass.com>",
      to: to,
      subject: subject,
      html: compileTemplate(template, templateDataWithDefaults),
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully to ${to}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error);
    throw error;
  }
};

// Send email verification
const sendVerificationEmail = async (user, verificationToken) => {
  const verificationURL = `${process.env.BASE_URL}/auth/verify?token=${verificationToken}`;

  const template = loadTemplate("email-verification");
  const templateData = {
    firstName: user.firstName,
    verificationURL: verificationURL,
  };

  const mailOptions = {
    from: "ShowPass <noreply@showpass.com>",
    to: user.email,
    subject: "Welcome to ShowPass - Please Verify Your Email",
    html: compileTemplate(template, templateData),
  };

  await transporter.sendMail(mailOptions);
};

// Send ticket confirmation email
const sendTicketConfirmation = async (user, booking, event, qrCodeImage) => {
  const template = loadTemplate("ticket-confirmation");
  const templateData = {
    firstName: user.firstName,
    eventTitle: event.title,
    eventDate: new Date(event.startDate).toLocaleDateString(),
    startTime: event.startTime,
    endTime: event.endTime,
    venueName: event.venue.name,
    venueAddress: event.venue.address,
    ticketType: booking.ticketType,
    quantity: booking.quantity,
    finalAmount: formatCurrency(booking.finalAmount),
    paymentReference: booking.paymentReference,
    qrCodeImage: "cid:qrcode", // Reference the attached image
    supportEmail: process.env.EMAIL_FROM,
  };

  // Convert data URL to buffer for attachment
  const base64Data = qrCodeImage.replace(/^data:image\/png;base64,/, "");
  const qrCodeBuffer = Buffer.from(base64Data, "base64");

  const mailOptions = {
    from: "ShowPass <noreply@showpass.com>",
    to: user.email,
    subject: `🎟️ Your Ticket for ${event.title} - ShowPass`,
    html: compileTemplate(template, templateData),
    attachments: [
      {
        filename: "qr-code.png",
        content: qrCodeBuffer,
        cid: "qrcode", // Same as referenced in template
      },
    ],
  };

  await transporter.sendMail(mailOptions);
};

// Send refund confirmation email
const sendRefundConfirmation = async (user, refundRequest, booking, event) => {
  const template = loadTemplate("refund-confirmation");
  const templateData = {
    firstName: user.firstName,
    eventTitle: event.title,
    paymentReference: booking.paymentReference,
    finalRefundAmount: formatCurrency(refundRequest.finalRefundAmount),
    processingFee: formatCurrency(refundRequest.processingFee),
    reason: refundRequest.reason,
    processedDate: new Date().toLocaleDateString(),
    supportEmail: process.env.EMAIL_FROM,
  };

  const mailOptions = {
    from: "ShowPass <noreply@showpass.com>",
    to: user.email,
    subject: `💰 Refund Processed - ${event.title} - ShowPass`,
    html: compileTemplate(template, templateData),
  };

  await transporter.sendMail(mailOptions);
};

// Send event update notification
const sendEventUpdateNotification = async (user, event, changeDetails) => {
  const template = loadTemplate("event-update-notification");
  const templateData = {
    firstName: user.firstName,
    eventTitle: event.title,
    changeDetails: changeDetails,
    eventDate: new Date(event.startDate).toLocaleDateString(),
    startTime: event.startTime,
    endTime: event.endTime,
    venueName: event.venue.name,
    venueAddress: event.venue.address,
    supportEmail: process.env.EMAIL_FROM,
  };

  const mailOptions = {
    from: "ShowPass <noreply@showpass.com>",
    to: user.email,
    subject: `📢 Important Update: ${event.title} - ShowPass`,
    html: compileTemplate(template, templateData),
  };

  await transporter.sendMail(mailOptions);
};

// Send password reset email
const sendPasswordResetEmail = async (user, resetToken) => {
  const resetURL = `${process.env.BASE_URL}/reset-password?token=${resetToken}`;

  const template = loadTemplate("password-reset");
  const templateData = {
    firstName: user.firstName,
    resetURL: resetURL,
  };

  const mailOptions = {
    from: "ShowPass <noreply@showpass.com>",
    to: user.email,
    subject: "Password Reset Request - ShowPass",
    html: compileTemplate(template, templateData),
  };

  await transporter.sendMail(mailOptions);
};

// Send account creation welcome email
const sendWelcomeEmail = async (user) => {
  const template = loadTemplate("welcome-email");

  // Generate role-specific features
  let roleFeatures = "";
  if (user.role === "admin") {
    roleFeatures = `
      <ul>
        <li>📊 Manage all events and users</li>
        <li>✅ Approve/reject events</li>
        <li>💰 Monitor platform analytics</li>
        <li>🔧 System administration</li>
      </ul>
    `;
  } else if (user.role === "organizer") {
    roleFeatures = `
      <ul>
        <li>🎪 Create and manage events</li>
        <li>🎟️ Track ticket sales</li>
        <li>📈 View event analytics</li>
        <li>💬 Communicate with attendees</li>
      </ul>
    `;
  } else {
    roleFeatures = `
      <ul>
        <li>🔍 Discover amazing events</li>
        <li>🎫 Purchase tickets securely</li>
        <li>📱 Get digital QR tickets</li>
        <li>❤️ Save favorite events</li>
      </ul>
    `;
  }

  const templateData = {
    firstName: user.firstName,
    role: user.role,
    roleFeatures: roleFeatures,
    email: user.email,
    password: user.password,
    supportEmail: process.env.EMAIL_FROM,
  };

  const mailOptions = {
    from: "ShowPass <noreply@showpass.com>",
    to: user.email,
    subject: "🎉 Welcome to ShowPass - Your Account is Ready!",
    html: compileTemplate(template, templateData),
  };

  await transporter.sendMail(mailOptions);
};

// Send event creation notification
const sendEventCreationNotification = async (organizer, event) => {
  const template = loadTemplate("event-creation-notification");

  // Generate ticket types list
  const ticketTypesList = event.ticketTypes
    .map(
      (ticket) => `
      <p><strong>${ticket.name}:</strong> ${
        ticket.isFree || ticket.price === 0
          ? "Free"
          : formatCurrency(ticket.price)
      } (${ticket.quantity} available)</p>
    `
    )
    .join("");

  // Generate next steps section based on status
  let nextStepsSection = "";
  if (event.status === "pending") {
    nextStepsSection = `
      <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <h4>⏳ Next Steps</h4>
        <p>Your event is currently under review by our admin team. You'll receive a notification once it's approved and ready for ticket sales.</p>
      </div>
    `;
  } else {
    nextStepsSection = `
      <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <h4>✅ Event Live</h4>
        <p>Your event is now live and ready for ${
          event.isFreeEvent ? "attendee registration" : "ticket sales"
        }! Start promoting your event to attract attendees.</p>
      </div>
    `;
  }

  const templateData = {
    firstName: organizer.firstName,
    eventTitle: event.title,
    category: event.category,
    eventDate: new Date(event.startDate).toLocaleDateString(),
    startTime: event.startTime,
    endTime: event.endTime,
    venueName: event.venue.name,
    status: event.status,
    eventType: event.isFreeEvent ? "🆓 Free Event" : "💰 Paid Event",
    ticketTypes: ticketTypesList,
    nextStepsSection: nextStepsSection,
    salesType: event.isFreeEvent ? "registrations" : "sales",
    supportEmail: process.env.EMAIL_FROM,
  };

  const mailOptions = {
    from: "ShowPass <noreply@showpass.com>",
    to: organizer.email,
    subject: `🎪 Event Created: ${event.title} - ShowPass`,
    html: compileTemplate(template, templateData),
  };

  await transporter.sendMail(mailOptions);
};

// Send admin notification for new event
const sendAdminEventNotification = async (admin, event, organizer) => {
  // Debug logging to help identify undefined organizer properties
  console.log("🔍 Debug - New event admin notification organizer data:", {
    firstName: organizer?.firstName,
    lastName: organizer?.lastName,
    email: organizer?.email,
    fullOrganizer: organizer,
  });

  const template = loadTemplate("admin-event-notification");

  // Generate ticket information
  const ticketInfo = event.ticketTypes
    .map(
      (ticket) => `
      <p><strong>${ticket.name}:</strong> ${
        ticket.isFree || ticket.price === 0
          ? "Free"
          : formatCurrency(ticket.price)
      } - ${ticket.quantity} tickets</p>
    `
    )
    .join("");

  const templateData = {
    eventTitle: event.title,
    organizerName: `${organizer.firstName || "Unknown"} ${
      organizer.lastName || ""
    }`,
    organizerEmail: organizer.email || "No email",
    category: event.category,
    eventDate: new Date(event.startDate).toLocaleDateString(),
    startTime: event.startTime,
    endTime: event.endTime,
    venueName: event.venue.name,
    venueCity: event.venue.city,
    eventType: event.isFreeEvent ? "🆓 Free Event" : "💰 Paid Event",
    description: event.description,
    ticketInfo: ticketInfo,
    reviewURL: `${process.env.ADMIN_DASHBOARD_URL}/events/${event._id}`,
  };

  const mailOptions = {
    from: "ShowPass <noreply@showpass.com>",
    to: admin.email,
    subject: `🔔 New Event Pending Review: ${event.title} - ShowPass Admin`,
    html: compileTemplate(template, templateData),
  };

  await transporter.sendMail(mailOptions);
};

// Send event approval notification to users
const sendEventApprovalNotification = async (users, event, organizer) => {
  const recipients = users
    .filter((user) => user.notifications?.newEvents !== false)
    .map((user) => user.email);

  if (recipients.length === 0) return;

  const template = loadTemplate("event-approval-notification");

  // Generate ticket prices section
  let ticketPricesSection = "";
  if (!event.isFreeEvent) {
    const ticketPrices = event.ticketTypes
      .map((ticket) =>
        ticket.price > 0
          ? `<p><strong>${ticket.name}:</strong> ${formatCurrency(
              ticket.price
            )}</p>`
          : `<p><strong>${ticket.name}:</strong> Free</p>`
      )
      .join("");

    ticketPricesSection = `
      <h4>🎟️ Ticket Prices</h4>
      ${ticketPrices}
    `;
  } else {
    ticketPricesSection =
      "<p><strong>This is a FREE event - no payment required!</strong></p>";
  }

  const templateData = {
    registrationType: event.isFreeEvent ? "for registration" : "for booking",
    eventTitle: event.title,
    freeBadge: event.isFreeEvent ? '<span class="free-badge">FREE</span>' : "",
    organizerName: `${organizer.firstName || "Unknown"} ${
      organizer.lastName || ""
    }`,
    category: event.category,
    eventDate: new Date(event.startDate).toLocaleDateString(),
    startTime: event.startTime,
    endTime: event.endTime,
    venueName: event.venue.name,
    venueCity: event.venue.city,
    description: event.description,
    ticketPricesSection: ticketPricesSection,
    eventURL: `${process.env.FRONTEND_URL}/events/${event._id}`,
    ctaButtonText: event.isFreeEvent ? "Register Now" : "Get Tickets",
    notificationPreferencesURL: `${process.env.FRONTEND_URL}/profile/notifications`,
  };

  const mailOptions = {
    from: "ShowPass <noreply@showpass.com>",
    bcc: recipients,
    subject: `🎉 New Event Available: ${event.title} - ShowPass`,
    html: compileTemplate(template, templateData),
  };

  await transporter.sendMail(mailOptions);
};

// Send event approval notification to organizer
const sendOrganizerApprovalNotification = async (
  organizer,
  event,
  isApproved,
  rejectionReason = null
) => {
  const template = loadTemplate("organizer-approval-notification");

  // Generate status-specific content
  let statusSpecificContent = "";
  if (isApproved) {
    statusSpecificContent = `
      <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <h4>🎉 Congratulations!</h4>
        <p>Your event is now live and available to the public. Users can now ${
          event.isFreeEvent ? "register for" : "purchase tickets for"
        } your event.</p>
        <p>We've also notified our user base about your new event!</p>
      </div>
    `;
  } else {
    if (rejectionReason) {
      statusSpecificContent = `
        <div class="rejection-reason">
          <h4>Rejection Reason:</h4>
          <p>${rejectionReason}</p>
        </div>
        <p>You can edit your event and resubmit it for review. Please address the concerns mentioned above.</p>
      `;
    }
  }

  const templateData = {
    approvalStatus: isApproved ? "Approved" : "Rejected",
    statusClass: isApproved ? "approved" : "rejected",
    firstName: organizer.firstName,
    emoji: isApproved ? "🎉" : "😔",
    statusMessage: isApproved
      ? "are pleased to inform you that it has been approved"
      : "unfortunately it has been rejected",
    eventTitle: event.title,
    eventDate: new Date(event.startDate).toLocaleDateString(),
    venueName: event.venue.name,
    statusSpecificContent: statusSpecificContent,
    supportEmail: process.env.EMAIL_FROM,
  };

  const mailOptions = {
    from: "ShowPass <noreply@showpass.com>",
    to: organizer.email,
    subject: `${isApproved ? "✅ Event Approved" : "❌ Event Rejected"}: ${
      event.title
    } - ShowPass`,
    html: compileTemplate(template, templateData),
  };

  await transporter.sendMail(mailOptions);
};

// Send organizer notification for event updates
const sendOrganizerEventUpdateNotification = async (
  organizer,
  event,
  changeDetails
) => {
  const template = loadTemplate("organizer-event-update-notification");

  // Generate status section
  let statusSection = "";
  if (event.approved) {
    statusSection =
      "<p><strong>Status:</strong> ✅ Your event is approved and attendees have been notified of the changes.</p>";
  } else {
    statusSection =
      '<div class="status-note"><strong>Status:</strong> ⏳ Your event is still pending approval. Changes will be visible to attendees once approved by our admin team.</div>';
  }

  const templateData = {
    firstName: organizer.firstName,
    eventTitle: event.title,
    changeDetails: changeDetails,
    statusSection: statusSection,
  };

  const mailOptions = {
    from: "ShowPass <noreply@showpass.com>",
    to: organizer.email,
    subject: `📝 Event Update Confirmation: ${event.title} - ShowPass`,
    html: compileTemplate(template, templateData),
  };

  await transporter.sendMail(mailOptions);
};

// Send admin notification for event updates
const sendAdminEventUpdateNotification = async (
  admin,
  event,
  organizer,
  changeDetails
) => {
  // Debug logging to help identify undefined organizer properties
  console.log("🔍 Debug - Admin notification organizer data:", {
    firstName: organizer?.firstName,
    lastName: organizer?.lastName,
    email: organizer?.email,
    fullOrganizer: organizer,
  });

  const template = loadTemplate("admin-event-update-notification");

  const templateData = {
    eventTitle: event.title,
    organizerName: `${organizer.firstName || "Unknown"} ${
      organizer.lastName || ""
    }`,
    organizerEmail: organizer.email || "No email",
    category: event.category,
    eventDate: new Date(event.startDate).toLocaleDateString(),
    startTime: event.startTime,
    endTime: event.endTime,
    changeDetails: changeDetails,
    approvalStatusClass: event.approved ? "approved" : "pending",
    approvalStatusMessage: event.approved
      ? "✅ Event is approved - attendees have been notified of changes"
      : "⏳ Event is pending approval - changes are not yet visible to attendees",
    reviewMessage: event.approved
      ? " and ensure they are appropriate"
      : " as part of the approval process",
  };

  const mailOptions = {
    from: "ShowPass <noreply@showpass.com>",
    to: admin.email,
    subject: `🔄 Event Updated: ${event.title} - ShowPass Admin`,
    html: compileTemplate(template, templateData),
  };

  await transporter.sendMail(mailOptions);
};

// Send organizer warning notification
const sendOrganizerWarningNotification = async (organizer, event, warning) => {
  // Debug logging to help identify undefined organizer properties
  console.log("🔍 Debug - Warning notification organizer data:", {
    firstName: organizer?.firstName,
    lastName: organizer?.lastName,
    email: organizer?.email,
    fullOrganizer: organizer,
  });

  const severityIcons = {
    minor: "⚠️",
    major: "🚨",
    critical: "🔴",
  };

  const template = loadTemplate("organizer-warning-notification");

  // Generate consequences section
  let consequencesSection = "";
  if (warning.severity === "critical" || event.warningCount >= 3) {
    consequencesSection = `
      <div class="consequences">
        <h4>🚫 Immediate Action Required</h4>
        <p><strong>Your event has been flagged for deletion</strong> due to ${
          warning.severity === "critical"
            ? "the critical nature of this violation"
            : "multiple policy violations"
        }.</p>
        <p>Please contact our support team immediately to discuss this matter and prevent event removal.</p>
      </div>
    `;
  } else {
    consequencesSection = `
      <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <h4>📋 Next Steps</h4>
        <p>Please review our event guidelines and ensure future updates comply with our policies.</p>
        <p><strong>Warning Count:</strong> ${event.warningCount}/3</p>
        <p><em>Note: Receiving 3 warnings or a critical violation may result in event removal.</em></p>
      </div>
    `;
  }

  const templateData = {
    severity: warning.severity,
    severityIcon: severityIcons[warning.severity],
    severityUpper: warning.severity.toUpperCase(),
    firstName: organizer.firstName || "Organizer",
    eventTitle: event.title,
    eventId: event._id,
    issuedDate: new Date(warning.issuedAt).toLocaleDateString(),
    reason: warning.reason,
    consequencesSection: consequencesSection,
    supportEmail: process.env.EMAIL_FROM,
  };

  const mailOptions = {
    from: "ShowPass <noreply@showpass.com>",
    to: organizer.email,
    subject: `${
      severityIcons[warning.severity]
    } ${warning.severity.toUpperCase()} Warning - Event Policy Violation - ShowPass`,
    html: compileTemplate(template, templateData),
  };

  await transporter.sendMail(mailOptions);
};

// Send event deletion notification to organizer
const sendEventDeletionNotification = async (organizer, event, reason) => {
  const template = loadTemplate("event-deletion-notification");

  const templateData = {
    firstName: organizer.firstName || "Organizer",
    eventTitle: event.title,
    eventId: event._id,
    removalDate: new Date().toLocaleDateString(),
    reason: reason,
    supportEmail: process.env.EMAIL_FROM,
  };

  const mailOptions = {
    from: "ShowPass <noreply@showpass.com>",
    to: organizer.email,
    subject: `🚫 Event Removed - ${event.title} - ShowPass`,
    html: compileTemplate(template, templateData),
  };

  await transporter.sendMail(mailOptions);
};

// Send admin notification when organizer deletes an event
const sendAdminEventDeletionNotification = async (
  admin,
  eventDetails,
  organizer
) => {
  try {
    console.log("🔍 Debug - Admin deletion notification data:", {
      adminEmail: admin.email,
      eventTitle: eventDetails.title,
      organizerEmail: organizer.email,
    });

    const template = loadTemplate("admin-event-deletion-notification");
    const templateData = {
      adminName: admin.firstName,
      eventId: eventDetails._id,
      eventTitle: eventDetails.title,
      eventDescription: eventDetails.description,
      organizerName: `${organizer.firstName} ${organizer.lastName}`,
      organizerEmail: organizer.email,
      eventDate: new Date(eventDetails.startDate).toLocaleDateString(),
      eventVenue: `${eventDetails.venue.name}, ${eventDetails.venue.address}`,
      deletionReason: eventDetails.deletionReason,
      deletionDate: new Date().toLocaleDateString(),
      isAdminDeletion: eventDetails.isAdminDeletion,
    };

    const compiledTemplate = compileTemplate(template, templateData);

    const mailOptions = {
      from: "ShowPass <noreply@showpass.com>",
      to: admin.email,
      subject: `Event Deleted: ${eventDetails.title}`,
      html: compiledTemplate,
    };

    await transporter.sendMail(mailOptions);
    console.log("✅ Admin event deletion notification sent successfully");
  } catch (error) {
    console.error(
      "❌ Failed to send admin event deletion notification:",
      error
    );
    throw error;
  }
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendTicketConfirmation,
  sendRefundConfirmation,
  sendEventUpdateNotification,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendEventCreationNotification,
  sendAdminEventNotification,
  sendEventApprovalNotification,
  sendOrganizerApprovalNotification,
  sendOrganizerEventUpdateNotification,
  sendAdminEventUpdateNotification,
  sendOrganizerWarningNotification,
  sendEventDeletionNotification,
  sendAdminEventDeletionNotification,
};
