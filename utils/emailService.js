const nodemailer = require("nodemailer");
const { formatCurrency } = require("./helpers");

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

// Send email verification
const sendVerificationEmail = async (user, verificationToken) => {
  const verificationURL = `${process.env.BASE_URL}/api/auth/verify-email?token=${verificationToken}`;

  const mailOptions = {
    from: "ShowPass <noreply@showpass.com>",
    to: user.email,
    subject: "Welcome to ShowPass - Please Verify Your Email",
    html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Email Verification - ShowPass</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f4; }
                .container { max-width: 100%; margin: 0 auto; background-color: white; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { padding: 10px; }
                .button { display: inline-block; padding: 12px 30px; background-color: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                .logo { font-size: 24px; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🎟️ ShowPass</div>
                    <h2>Welcome to ShowPass!</h2>
                </div>
                <div class="content">
                    <h3>Hello ${user.firstName}!</h3>
                    <p>Thank you for joining ShowPass, your premier event ticketing platform!</p>
                    <p>To complete your registration and start exploring amazing events, please verify your email address by clicking the button below:</p>
                    <div style="text-align: center;">
                        <a href="${verificationURL}" class="button">Verify Email Address</a>
                    </div>
                    <p>If you can't click the button, copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; color: #667eea;">${verificationURL}</p>
                    <p><strong>This link will expire in 24 hours.</strong></p>
                    <p>If you didn't create an account with ShowPass, please ignore this email.</p>
                </div>
                <div class="footer">
                    <p>© 2024 ShowPass. All rights reserved.</p>
                    <p>This is an automated email, please do not reply.</p>
                </div>
            </div>
        </body>
        </html>
        `,
  };

  await transporter.sendMail(mailOptions);
};

// Send ticket confirmation email
const sendTicketConfirmation = async (user, booking, event, qrCodeImage) => {
  const mailOptions = {
    from: "ShowPass <noreply@showpass.com>",
    to: user.email,
    subject: `🎟️ Your Ticket for ${event.title} - ShowPass`,
    html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Ticket Confirmation - ShowPass</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f4; }
                .container { max-width: 100%; margin: 0 auto; background-color: white; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { padding: 10px; }
                .ticket-details { background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0; }
                .qr-code { text-align: center; margin: 20px 0; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                .logo { font-size: 24px; font-weight: bold; }
                .important { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 5px; margin: 10px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🎟️ ShowPass</div>
                    <h2>Your Ticket is Ready!</h2>
                </div>
                <div class="content">
                    <h3>Hello ${user.firstName}!</h3>
                    <p>Great news! Your ticket purchase was successful. Here are your ticket details:</p>
                    
                    <div class="ticket-details">
                        <h4>📅 Event Details</h4>
                        <p><strong>Event:</strong> ${event.title}</p>
                        <p><strong>Date:</strong> ${new Date(
                          event.startDate
                        ).toLocaleDateString()}</p>
                        <p><strong>Time:</strong> ${event.startTime} - ${
      event.endTime
    }</p>
                        <p><strong>Venue:</strong> ${event.venue.name}, ${
      event.venue.address
    }</p>
                        
                        <h4>🎟️ Ticket Information</h4>
                        <p><strong>Ticket Type:</strong> ${
                          booking.ticketType
                        }</p>
                        <p><strong>Quantity:</strong> ${booking.quantity}</p>
                        <p><strong>Amount Paid:</strong> ${formatCurrency(
                          booking.finalAmount
                        )}</p>
                        <p><strong>Booking Reference:</strong> ${
                          booking.paymentReference
                        }</p>
                    </div>
                    
                    <div class="qr-code">
                        <h4>📱 Your Digital Ticket</h4>
                        <p>Show this QR code at the event entrance:</p>
                        <img src="${qrCodeImage}" alt="Ticket QR Code" style="max-width: 200px; height: auto;">
                    </div>
                    
                    <div class="important">
                        <h4>⚠️ Important Information</h4>
                        <ul>
                            <li>Please arrive at least 30 minutes before the event starts</li>
                            <li>Bring a valid ID for verification</li>
                            <li>Screenshot or print this email for backup</li>
                            <li>This ticket is non-transferable</li>
                        </ul>
                    </div>
                    
                    <p>We're excited to see you at the event! If you have any questions, please contact our support team.</p>
                </div>
                <div class="footer">
                    <p>© 2024 ShowPass. All rights reserved.</p>
                    <p>Event support: ${process.env.EMAIL_FROM}</p>
                </div>
            </div>
        </body>
        </html>
        `,
  };

  await transporter.sendMail(mailOptions);
};

// Send refund confirmation email
const sendRefundConfirmation = async (user, refundRequest, booking, event) => {
  const mailOptions = {
    from: "ShowPass <noreply@showpass.com>",
    to: user.email,
    subject: `💰 Refund Processed - ${event.title} - ShowPass`,
    html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Refund Confirmation - ShowPass</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f4; }
                .container { max-width: 100%; margin: 0 auto; background-color: white; }
                .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { padding: 10px; }
                .refund-details { background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                .logo { font-size: 24px; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🎟️ ShowPass</div>
                    <h2>Refund Processed Successfully</h2>
                </div>
                <div class="content">
                    <h3>Hello ${user.firstName}!</h3>
                    <p>Your refund request has been processed successfully. The refund amount will be credited to your original payment method within 3-5 business days.</p>
                    
                    <div class="refund-details">
                        <h4>💰 Refund Details</h4>
                        <p><strong>Event:</strong> ${event.title}</p>
                        <p><strong>Original Booking:</strong> ${
                          booking.paymentReference
                        }</p>
                        <p><strong>Refund Amount:</strong> ${formatCurrency(
                          refundRequest.finalRefundAmount
                        )}</p>
                        <p><strong>Processing Fee:</strong> ${formatCurrency(
                          refundRequest.processingFee
                        )}</p>
                        <p><strong>Refund Reason:</strong> ${
                          refundRequest.reason
                        }</p>
                        <p><strong>Processed Date:</strong> ${new Date().toLocaleDateString()}</p>
                    </div>
                    
                    <p>If you don't see the refund in your account after 5 business days, please contact our support team with your booking reference.</p>
                    
                    <p>Thank you for using ShowPass. We hope to serve you again soon!</p>
                </div>
                <div class="footer">
                    <p>© 2024 ShowPass. All rights reserved.</p>
                    <p>Support: ${process.env.EMAIL_FROM}</p>
                </div>
            </div>
        </body>
        </html>
        `,
  };

  await transporter.sendMail(mailOptions);
};

// Send event update notification
const sendEventUpdateNotification = async (user, event, changeDetails) => {
  const mailOptions = {
    from: "ShowPass <noreply@showpass.com>",
    to: user.email,
    subject: `📢 Important Update: ${event.title} - ShowPass`,
    html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Event Update - ShowPass</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f4; }
                .container { max-width: 100%; margin: 0 auto; background-color: white; }
                .header { background: linear-gradient(135deg, #ffc107 0%, #ff8f00 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { padding: 10px; }
                .update-details { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 10px; margin: 20px 0; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                .logo { font-size: 24px; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🎟️ ShowPass</div>
                    <h2>Event Update Notification</h2>
                </div>
                <div class="content">
                    <h3>Hello ${user.firstName}!</h3>
                    <p>We wanted to inform you about an important update to an event you have tickets for:</p>
                    
                    <div class="update-details">
                        <h4>📅 Event: ${event.title}</h4>
                        <h4>🔄 What Changed:</h4>
                        <p>${changeDetails}</p>
                        
                        <h4>📍 Current Event Details:</h4>
                        <p><strong>Date:</strong> ${new Date(
                          event.startDate
                        ).toLocaleDateString()}</p>
                        <p><strong>Time:</strong> ${event.startTime} - ${
      event.endTime
    }</p>
                        <p><strong>Venue:</strong> ${event.venue.name}, ${
      event.venue.address
    }</p>
                    </div>
                    
                    <p>If these changes significantly impact your ability to attend, you may request a refund through your ShowPass account.</p>
                    
                    <p>Thank you for your understanding, and we apologize for any inconvenience.</p>
                </div>
                <div class="footer">
                    <p>© 2024 ShowPass. All rights reserved.</p>
                    <p>Support: ${process.env.EMAIL_FROM}</p>
                </div>
            </div>
        </body>
        </html>
        `,
  };

  await transporter.sendMail(mailOptions);
};

// Send password reset email
const sendPasswordResetEmail = async (user, resetToken) => {
  const resetURL = `${process.env.BASE_URL}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: "ShowPass <noreply@showpass.com>",
    to: user.email,
    subject: "Password Reset Request - ShowPass",
    html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Password Reset - ShowPass</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f4; }
                .container { max-width: 100%; margin: 0 auto; background-color: white; }
                .header { background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { padding: 10px; }
                .button { display: inline-block; padding: 12px 30px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                .logo { font-size: 24px; font-weight: bold; }
                .warning { background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 10px; border-radius: 5px; margin: 10px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🎟️ ShowPass</div>
                    <h2>Password Reset Request</h2>
                </div>
                <div class="content">
                    <h3>Hello ${user.firstName}!</h3>
                    <p>We received a request to reset your password for your ShowPass account.</p>
                    <p>Click the button below to reset your password:</p>
                    <div style="text-align: center;">
                        <a href="${resetURL}" class="button">Reset Password</a>
                    </div>
                    <p>If you can't click the button, copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; color: #dc3545;">${resetURL}</p>
                    
                    <div class="warning">
                        <p><strong>⚠️ Security Notice:</strong></p>
                        <ul>
                            <li>This link will expire in 1 hour</li>
                            <li>If you didn't request a password reset, please ignore this email</li>
                            <li>Your password will remain unchanged until you create a new one</li>
                        </ul>
                    </div>
                </div>
                <div class="footer">
                    <p>© 2024 ShowPass. All rights reserved.</p>
                    <p>This is an automated email, please do not reply.</p>
                </div>
            </div>
        </body>
        </html>
        `,
  };

  await transporter.sendMail(mailOptions);
};

// Send account creation welcome email
const sendWelcomeEmail = async (user) => {
  const mailOptions = {
    from: "ShowPass <noreply@showpass.com>",
    to: user.email,
    subject: "🎉 Welcome to ShowPass - Your Account is Ready!",
    html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to ShowPass</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f4; }
                .container { max-width: 100%; margin: 0 auto; background-color: white; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { padding: 10px; }
                .role-badge { display: inline-block; padding: 5px 15px; background-color: #28a745; color: white; border-radius: 15px; font-size: 12px; text-transform: uppercase; }
                .features { background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0; }
                .features ul { list-style-type: none; padding: 0; }
                .features li { margin: 5px 0; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                .logo { font-size: 24px; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🎟️ ShowPass</div>
                    <h2>Welcome to ShowPass!</h2>
                </div>
                <div class="content">
                    <h3>Hello ${user.firstName}! 👋</h3>
                    <p>Your ShowPass account has been successfully created!</p>
                    <p><strong>Account Type:</strong> <span class="role-badge">${
                      user.role
                    }</span></p>
                    
                    <div class="features">
                        <h4>🎯 What you can do with ShowPass:</h4>
                        ${
                          user.role === "admin"
                            ? `
                        <ul>
                            <li>📊 Manage all events and users</li>
                            <li>✅ Approve/reject events</li>
                            <li>💰 Monitor platform analytics</li>
                            <li>🔧 System administration</li>
                        </ul>
                        `
                            : user.role === "organizer"
                            ? `
                        <ul>
                            <li>🎪 Create and manage events</li>
                            <li>🎟️ Track ticket sales</li>
                            <li>📈 View event analytics</li>
                            <li>💬 Communicate with attendees</li>
                        </ul>
                        `
                            : `
                        <ul>
                            <li>🔍 Discover amazing events</li>
                            <li>🎫 Purchase tickets securely</li>
                            <li>📱 Get digital QR tickets</li>
                            <li>❤️ Save favorite events</li>
                        </ul>
                        `
                        }
                    </div>
                    
                    <p><strong>Login Credentials:</strong></p>
                    <p>📧 Email: ${user.email}</p>
                    <p>🔒 Password: Use ${user.password} to log in</p>

                    <p>Ready to get started? Log in to your account and explore what ShowPass has to offer!</p>
                </div>
                <div class="footer">
                    <p>© 2024 ShowPass. All rights reserved.</p>
                    <p>Questions? Contact us at ${process.env.EMAIL_FROM}</p>
                </div>
            </div>
        </body>
        </html>
        `,
  };

  await transporter.sendMail(mailOptions);
};

// Send event creation notification
const sendEventCreationNotification = async (organizer, event) => {
  const mailOptions = {
    from: "ShowPass <noreply@showpass.com>",
    to: organizer.email,
    subject: `🎪 Event Created: ${event.title} - ShowPass`,
    html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Event Created - ShowPass</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f4; }
                .container { max-width: 100%; margin: 0 auto; background-color: white; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { padding: 10px; }
                .event-details { background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0; }
                .status-badge { display: inline-block; padding: 5px 15px; background-color: #ffc107; color: #212529; border-radius: 15px; font-size: 12px; text-transform: uppercase; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                .logo { font-size: 24px; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🎟️ ShowPass</div>
                    <h2>Event Created Successfully!</h2>
                </div>
                <div class="content">
                    <h3>Hello ${organizer.firstName}! 🎉</h3>
                    <p>Great news! Your event has been created successfully on ShowPass.</p>
                    
                    <div class="event-details">
                        <h4>📅 Event Information</h4>
                        <p><strong>Event Title:</strong> ${event.title}</p>
                        <p><strong>Category:</strong> ${event.category}</p>
                        <p><strong>Date:</strong> ${new Date(
                          event.startDate
                        ).toLocaleDateString()}</p>
                        <p><strong>Time:</strong> ${event.startTime} - ${
      event.endTime
    }</p>
                        <p><strong>Venue:</strong> ${event.venue.name}</p>
                        <p><strong>Status:</strong> <span class="status-badge">${
                          event.status
                        }</span></p>
                        <p><strong>Event Type:</strong> ${
                          event.isFreeEvent ? "🆓 Free Event" : "💰 Paid Event"
                        }</p>
                        
                        <h4>🎟️ Ticket Types</h4>
                        ${event.ticketTypes
                          .map(
                            (ticket) => `
                            <p><strong>${ticket.name}:</strong> ${
                              ticket.isFree || ticket.price === 0
                                ? "Free"
                                : formatCurrency(ticket.price)
                            } (${ticket.quantity} available)</p>
                        `
                          )
                          .join("")}
                    </div>
                    
                    ${
                      event.status === "pending"
                        ? `
                    <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0;">
                        <h4>⏳ Next Steps</h4>
                        <p>Your event is currently under review by our admin team. You'll receive a notification once it's approved and ready for ticket sales.</p>
                    </div>
                    `
                        : `
                    <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 15px 0;">
                        <h4>✅ Event Live</h4>
                        <p>Your event is now live and ready for ${
                          event.isFreeEvent
                            ? "attendee registration"
                            : "ticket sales"
                        }! Start promoting your event to attract attendees.</p>
                    </div>
                    `
                    }
                    
                    <p>You can manage your event, track ${
                      event.isFreeEvent ? "registrations" : "sales"
                    }, and view analytics from your organizer dashboard.</p>
                </div>
                <div class="footer">
                    <p>© 2024 ShowPass. All rights reserved.</p>
                    <p>Need help? Contact us at ${process.env.EMAIL_FROM}</p>
                </div>
            </div>
        </body>
        </html>
        `,
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

  const mailOptions = {
    from: "ShowPass <noreply@showpass.com>",
    to: admin.email,
    subject: `🔔 New Event Pending Review: ${event.title} - ShowPass Admin`,
    html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>New Event Review - ShowPass Admin</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f4; }
                .container { max-width: 100%; margin: 0 auto; background-color: white; }
                .header { background: linear-gradient(135deg, #dc3545 0%, #bd2130 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { padding: 10px; }
                .event-details { background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0; }
                .action-buttons { text-align: center; margin: 20px 0; }
                .btn { display: inline-block; padding: 10px 20px; margin: 0 10px; border-radius: 5px; text-decoration: none; font-weight: bold; }
                .btn-approve { background-color: #28a745; color: white; }
                .btn-review { background-color: #007bff; color: white; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                .logo { font-size: 24px; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">👑 ShowPass Admin</div>
                    <h2>New Event Requires Review</h2>
                </div>
                <div class="content">
                    <h3>Hello Admin! 📋</h3>
                    <p>A new event has been submitted and requires your review for approval.</p>
                    
                    <div class="event-details">
                        <h4>📅 Event Information</h4>
                        <p><strong>Event Title:</strong> ${event.title}</p>
                        <p><strong>Organizer:</strong> ${
                          organizer.firstName || "Unknown"
                        } ${organizer.lastName || ""} (${
      organizer.email || "No email"
    })</p>
                        <p><strong>Category:</strong> ${event.category}</p>
                        <p><strong>Date:</strong> ${new Date(
                          event.startDate
                        ).toLocaleDateString()}</p>
                        <p><strong>Time:</strong> ${event.startTime} - ${
      event.endTime
    }</p>
                        <p><strong>Venue:</strong> ${event.venue.name}, ${
      event.venue.city
    }</p>
                        <p><strong>Event Type:</strong> ${
                          event.isFreeEvent ? "🆓 Free Event" : "💰 Paid Event"
                        }</p>
                        
                        <h4>📝 Description</h4>
                        <p>${event.description}</p>
                        
                        <h4>🎟️ Ticket Information</h4>
                        ${event.ticketTypes
                          .map(
                            (ticket) => `
                            <p><strong>${ticket.name}:</strong> ${
                              ticket.isFree || ticket.price === 0
                                ? "Free"
                                : formatCurrency(ticket.price)
                            } - ${ticket.quantity} tickets</p>
                        `
                          )
                          .join("")}
                    </div>
                    
                    <div class="action-buttons">
                        <a href="${process.env.ADMIN_DASHBOARD_URL}/events/${
      event._id
    }" class="btn btn-review">Review Event</a>
                    </div>
                    
                    <p>Please review this event and take appropriate action from your admin dashboard.</p>
                </div>
                <div class="footer">
                    <p>© 2024 ShowPass Admin Panel. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        `,
  };

  await transporter.sendMail(mailOptions);
};

// Send event approval notification to users
const sendEventApprovalNotification = async (users, event, organizer) => {
  const recipients = users
    .filter((user) => user.notifications?.newEvents !== false)
    .map((user) => user.email);

  if (recipients.length === 0) return;

  const mailOptions = {
    from: "ShowPass <noreply@showpass.com>",
    bcc: recipients,
    subject: `🎉 New Event Available: ${event.title} - ShowPass`,
    html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>New Event Available - ShowPass</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f4; }
                .container { max-width: 100%; margin: 0 auto; background-color: white; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { padding: 10px; }
                .event-details { background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0; }
                .cta-button { text-align: center; margin: 20px 0; }
                .btn { display: inline-block; padding: 12px 30px; background-color: #28a745; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                .logo { font-size: 24px; font-weight: bold; }
                .free-badge { background-color: #28a745; color: white; padding: 3px 8px; border-radius: 12px; font-size: 11px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🎟️ ShowPass</div>
                    <h2>New Event Available!</h2>
                </div>
                <div class="content">
                    <h3>Hello! 🎉</h3>
                    <p>Exciting news! A new event has been approved and is now available ${
                      event.isFreeEvent ? "for registration" : "for booking"
                    }.</p>
                    
                    <div class="event-details">
                        <h4>📅 ${event.title} ${
      event.isFreeEvent ? '<span class="free-badge">FREE</span>' : ""
    }</h4>
                        <p><strong>Organized by:</strong> ${
                          organizer.firstName || "Unknown"
                        } ${organizer.lastName || ""}</p>
                        <p><strong>Category:</strong> ${event.category}</p>
                        <p><strong>Date:</strong> ${new Date(
                          event.startDate
                        ).toLocaleDateString()}</p>
                        <p><strong>Time:</strong> ${event.startTime} - ${
      event.endTime
    }</p>
                        <p><strong>Venue:</strong> ${event.venue.name}, ${
      event.venue.city
    }</p>
                        
                        <p><strong>Description:</strong></p>
                        <p>${event.description}</p>
                        
                        ${
                          !event.isFreeEvent
                            ? `
                        <h4>🎟️ Ticket Prices</h4>
                        ${event.ticketTypes
                          .map((ticket) =>
                            ticket.price > 0
                              ? `<p><strong>${
                                  ticket.name
                                }:</strong> ${formatCurrency(ticket.price)}</p>`
                              : `<p><strong>${ticket.name}:</strong> Free</p>`
                          )
                          .join("")}
                        `
                            : "<p><strong>This is a FREE event - no payment required!</strong></p>"
                        }
                    </div>
                    
                    <div class="cta-button">
                        <a href="${process.env.FRONTEND_URL}/events/${
      event._id
    }" class="btn">
                            ${
                              event.isFreeEvent ? "Register Now" : "Get Tickets"
                            }
                        </a>
                    </div>
                    
                    <p>Don't miss out on this amazing event!</p>
                </div>
                <div class="footer">
                    <p>© 2024 ShowPass. All rights reserved.</p>
                    <p>Want to stop receiving these notifications? <a href="${
                      process.env.FRONTEND_URL
                    }/profile/notifications">Update your preferences</a></p>
                </div>
            </div>
        </body>
        </html>
        `,
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
  const mailOptions = {
    from: "ShowPass <noreply@showpass.com>",
    to: organizer.email,
    subject: `${isApproved ? "✅ Event Approved" : "❌ Event Rejected"}: ${
      event.title
    } - ShowPass`,
    html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Event ${
              isApproved ? "Approved" : "Rejected"
            } - ShowPass</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f4; }
                .container { max-width: 100%; margin: 0 auto; background-color: white; }
                .header { background: linear-gradient(135deg, ${
                  isApproved ? "#28a745, #20c997" : "#dc3545, #c82333"
                }); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { padding: 10px; }
                .event-details { background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0; }
                .status-badge { display: inline-block; padding: 5px 15px; background-color: ${
                  isApproved ? "#28a745" : "#dc3545"
                }; color: white; border-radius: 15px; font-size: 12px; text-transform: uppercase; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                .logo { font-size: 24px; font-weight: bold; }
                .rejection-reason { background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; margin: 15px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🎟️ ShowPass</div>
                    <h2>Event ${isApproved ? "Approved" : "Rejected"}</h2>
                </div>
                <div class="content">
                    <h3>Hello ${organizer.firstName}! ${
      isApproved ? "🎉" : "😔"
    }</h3>
                    <p>We have reviewed your event submission and ${
                      isApproved
                        ? "are pleased to inform you that it has been approved"
                        : "unfortunately it has been rejected"
                    }.</p>
                    
                    <div class="event-details">
                        <h4>📅 Event Information</h4>
                        <p><strong>Event Title:</strong> ${event.title}</p>
                        <p><strong>Status:</strong> <span class="status-badge">${
                          isApproved ? "Approved" : "Rejected"
                        }</span></p>
                        <p><strong>Date:</strong> ${new Date(
                          event.startDate
                        ).toLocaleDateString()}</p>
                        <p><strong>Venue:</strong> ${event.venue.name}</p>
                    </div>
                    
                    ${
                      isApproved
                        ? `
                    <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 15px 0;">
                        <h4>🎉 Congratulations!</h4>
                        <p>Your event is now live and available to the public. Users can now ${
                          event.isFreeEvent
                            ? "register for"
                            : "purchase tickets for"
                        } your event.</p>
                        <p>We've also notified our user base about your new event!</p>
                    </div>
                    `
                        : `
                    ${
                      rejectionReason
                        ? `
                    <div class="rejection-reason">
                        <h4>Rejection Reason:</h4>
                        <p>${rejectionReason}</p>
                    </div>
                    <p>You can edit your event and resubmit it for review. Please address the concerns mentioned above.</p>
                    `
                        : ""
                    }
                    `
                    }
                    
                    <p>You can manage your events from your organizer dashboard.</p>
                </div>
                <div class="footer">
                    <p>© 2024 ShowPass. All rights reserved.</p>
                    <p>Need help? Contact us at ${process.env.EMAIL_FROM}</p>
                </div>
            </div>
        </body>
        </html>
        `,
  };

  await transporter.sendMail(mailOptions);
};

// Send organizer notification for event updates
const sendOrganizerEventUpdateNotification = async (
  organizer,
  event,
  changeDetails
) => {
  const mailOptions = {
    from: "ShowPass <noreply@showpass.com>",
    to: organizer.email,
    subject: `📝 Event Update Confirmation: ${event.title} - ShowPass`,
    html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Event Update Confirmation - ShowPass</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f4; }
                .container { max-width: 100%; margin: 0 auto; background-color: white; }
                .header { background: linear-gradient(135deg, #17a2b8 0%, #138496 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { padding: 10px; }
                .changes { background-color: #e8f4fd; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #17a2b8; }
                .change-item { margin: 10px 0; padding: 10px; background-color: white; border-radius: 5px; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                .logo { font-size: 24px; font-weight: bold; }
                .status-note { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 20px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">📝 ShowPass Organizer</div>
                    <h2>Event Update Confirmation</h2>
                </div>
                <div class="content">
                    <h3>Hello ${organizer.firstName}! ✅</h3>
                    <p>Your event "<strong>${
                      event.title
                    }</strong>" has been successfully updated.</p>
                    
                    <div class="changes">
                        <h4>📋 Changes Made:</h4>
                        ${changeDetails}
                    </div>

                    ${
                      event.approved
                        ? "<p><strong>Status:</strong> ✅ Your event is approved and attendees have been notified of the changes.</p>"
                        : '<div class="status-note"><strong>Status:</strong> ⏳ Your event is still pending approval. Changes will be visible to attendees once approved by our admin team.</div>'
                    }
                    
                    <p>Thank you for keeping your event information up to date!</p>
                </div>
                <div class="footer">
                    <p>Best regards,<br>The ShowPass Team</p>
                    <p>This is an automated message. Please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
        `,
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

  const mailOptions = {
    from: "ShowPass <noreply@showpass.com>",
    to: admin.email,
    subject: `🔄 Event Updated: ${event.title} - ShowPass Admin`,
    html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Event Update Notification - ShowPass Admin</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f4; }
                .container { max-width: 100%; margin: 0 auto; background-color: white; }
                .header { background: linear-gradient(135deg, #dc3545 0%, #bd2130 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { padding: 10px; }
                .event-info { background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0; }
                .changes { background-color: #fff3cd; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #ffc107; }
                .change-item { margin: 10px 0; padding: 10px; background-color: white; border-radius: 5px; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                .logo { font-size: 24px; font-weight: bold; }
                .approval-status { padding: 15px; border-radius: 8px; margin: 20px 0; }
                .approved { background-color: #d4edda; border: 1px solid #c3e6cb; }
                .pending { background-color: #fff3cd; border: 1px solid #ffeaa7; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">👑 ShowPass Admin</div>
                    <h2>Event Update Notification</h2>
                </div>
                <div class="content">
                    <h3>Hello Admin! 🔄</h3>
                    <p>An organizer has updated their event details.</p>
                    
                    <div class="event-info">
                        <h4>📅 Event Information</h4>
                        <p><strong>Event Title:</strong> ${event.title}</p>
                        <p><strong>Organizer:</strong> ${
                          organizer.firstName || "Unknown"
                        } ${organizer.lastName || ""} (${
      organizer.email || "No email"
    })</p>
                        <p><strong>Category:</strong> ${event.category}</p>
                        <p><strong>Date:</strong> ${new Date(
                          event.startDate
                        ).toLocaleDateString()}</p>
                        <p><strong>Time:</strong> ${event.startTime} - ${
      event.endTime
    }</p>
                    </div>

                    <div class="changes">
                        <h4>🔄 Changes Made by Organizer:</h4>
                        ${changeDetails}
                    </div>

                    <div class="approval-status ${
                      event.approved ? "approved" : "pending"
                    }">
                        <strong>Current Status:</strong> ${
                          event.approved
                            ? "✅ Event is approved - attendees have been notified of changes"
                            : "⏳ Event is pending approval - changes are not yet visible to attendees"
                        }
                    </div>
                    
                    <p>Please review these changes${
                      event.approved
                        ? " and ensure they are appropriate"
                        : " as part of the approval process"
                    }.</p>
                </div>
                <div class="footer">
                    <p>Best regards,<br>The ShowPass System</p>
                    <p>This is an automated notification. Please review the event in the admin panel.</p>
                </div>
            </div>
        </body>
        </html>
        `,
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

  const severityColors = {
    minor: "#ffc107",
    major: "#fd7e14",
    critical: "#dc3545",
  };

  const severityIcons = {
    minor: "⚠️",
    major: "🚨",
    critical: "🔴",
  };

  const mailOptions = {
    from: "ShowPass <noreply@showpass.com>",
    to: organizer.email,
    subject: `${
      severityIcons[warning.severity]
    } ${warning.severity.toUpperCase()} Warning - Event Policy Violation - ShowPass`,
    html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Warning Notice - ShowPass</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f4; }
                .container { max-width: 100%; margin: 0 auto; background-color: white; }
                .header { background: linear-gradient(135deg, ${
                  severityColors[warning.severity]
                } 0%, #e74c3c 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { padding: 10px; }
                .warning-box { background-color: #fff3cd; border: 2px solid ${
                  severityColors[warning.severity]
                }; padding: 20px; border-radius: 10px; margin: 20px 0; }
                .event-details { background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                .logo { font-size: 24px; font-weight: bold; }
                .severity-badge { background-color: ${
                  severityColors[warning.severity]
                }; color: white; padding: 5px 10px; border-radius: 15px; font-weight: bold; }
                .consequences { background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 8px; margin: 15px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">${
                      severityIcons[warning.severity]
                    } ShowPass Warning</div>
                    <h2>${warning.severity.toUpperCase()} Policy Violation</h2>
                </div>
                <div class="content">
                    <h3>Hello ${organizer.firstName || "Organizer"},</h3>
                    <p>We need to bring to your attention a policy violation regarding your event on ShowPass.</p>
                    
                    <div class="event-details">
                        <h4>📅 Event Information</h4>
                        <p><strong>Event:</strong> ${event.title}</p>
                        <p><strong>Event ID:</strong> ${event._id}</p>
                        <p><strong>Warning Level:</strong> <span class="severity-badge">${warning.severity.toUpperCase()}</span></p>
                        <p><strong>Date Issued:</strong> ${new Date(
                          warning.issuedAt
                        ).toLocaleDateString()}</p>
                    </div>
                    
                    <div class="warning-box">
                        <h4>${
                          severityIcons[warning.severity]
                        } Violation Details</h4>
                        <p><strong>Reason:</strong> ${warning.reason}</p>
                    </div>
                    
                    ${
                      warning.severity === "critical" || event.warningCount >= 3
                        ? `
                    <div class="consequences">
                        <h4>🚫 Immediate Action Required</h4>
                        <p><strong>Your event has been flagged for deletion</strong> due to ${
                          warning.severity === "critical"
                            ? "the critical nature of this violation"
                            : "multiple policy violations"
                        }.</p>
                        <p>Please contact our support team immediately to discuss this matter and prevent event removal.</p>
                    </div>
                    `
                        : `
                    <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 8px; margin: 15px 0;">
                        <h4>📋 Next Steps</h4>
                        <p>Please review our event guidelines and ensure future updates comply with our policies.</p>
                        <p><strong>Warning Count:</strong> ${event.warningCount}/3</p>
                        <p><em>Note: Receiving 3 warnings or a critical violation may result in event removal.</em></p>
                    </div>
                    `
                    }
                    
                    <p>If you believe this warning was issued in error, please contact our support team with details.</p>
                    <p>Thank you for your cooperation in maintaining the quality of events on ShowPass.</p>
                </div>
                <div class="footer">
                    <p>© 2024 ShowPass. All rights reserved.</p>
                    <p>Support: ${
                      process.env.EMAIL_FROM
                    } | This is an automated notice.</p>
                </div>
            </div>
        </body>
        </html>
        `,
  };

  await transporter.sendMail(mailOptions);
};

// Send event deletion notification to organizer
const sendEventDeletionNotification = async (organizer, event, reason) => {
  const mailOptions = {
    from: "ShowPass <noreply@showpass.com>",
    to: organizer.email,
    subject: `🚫 Event Removed - ${event.title} - ShowPass`,
    html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Event Removal Notice - ShowPass</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; background-color: #f4f4f4; }
                .container { max-width: 100%; margin: 0 auto; background-color: white; }
                .header { background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { padding: 10px; }
                .deletion-notice { background-color: #f8d7da; border: 2px solid #dc3545; padding: 20px; border-radius: 10px; margin: 20px 0; }
                .event-details { background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                .logo { font-size: 24px; font-weight: bold; }
                .support-info { background-color: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 8px; margin: 15px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">🚫 ShowPass</div>
                    <h2>Event Removal Notice</h2>
                </div>
                <div class="content">
                    <h3>Hello ${organizer.firstName || "Organizer"},</h3>
                    <p>We regret to inform you that your event has been removed from ShowPass.</p>
                    
                    <div class="event-details">
                        <h4>📅 Removed Event</h4>
                        <p><strong>Event Title:</strong> ${event.title}</p>
                        <p><strong>Event ID:</strong> ${event._id}</p>
                        <p><strong>Removal Date:</strong> ${new Date().toLocaleDateString()}</p>
                    </div>
                    
                    <div class="deletion-notice">
                        <h4>🚫 Removal Reason</h4>
                        <p>${reason}</p>
                    </div>
                    
                    <div class="support-info">
                        <h4>📞 Need Help?</h4>
                        <p>If you have questions about this removal or would like to appeal this decision, please contact our support team.</p>
                        <p><strong>Support Email:</strong> ${
                          process.env.EMAIL_FROM
                        }</p>
                        <p>Include your event ID and organizer email in your inquiry.</p>
                    </div>
                    
                    <p>We appreciate your understanding and encourage you to review our event guidelines for future submissions.</p>
                </div>
                <div class="footer">
                    <p>© 2024 ShowPass. All rights reserved.</p>
                    <p>This is an automated notification. Please contact support for assistance.</p>
                </div>
            </div>
        </body>
        </html>
        `,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = {
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
};
