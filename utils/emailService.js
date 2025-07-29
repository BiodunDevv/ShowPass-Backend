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
    from: process.env.EMAIL_FROM,
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
                .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: white; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { padding: 30px 20px; }
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
    from: process.env.EMAIL_FROM,
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
                .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: white; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { padding: 30px 20px; }
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
    from: process.env.EMAIL_FROM,
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
                .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: white; }
                .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { padding: 30px 20px; }
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
    from: process.env.EMAIL_FROM,
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
                .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: white; }
                .header { background: linear-gradient(135deg, #ffc107 0%, #ff8f00 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { padding: 30px 20px; }
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
    from: process.env.EMAIL_FROM,
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
                .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: white; }
                .header { background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { padding: 30px 20px; }
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
    from: process.env.EMAIL_FROM,
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
                .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: white; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { padding: 30px 20px; }
                .role-badge { display: inline-block; padding: 5px 15px; background-color: #28a745; color: white; border-radius: 15px; font-size: 12px; text-transform: uppercase; }
                .features { background-color: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0; }
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
                    <p>🔒 Use the password you created during registration</p>
                    
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
    from: process.env.EMAIL_FROM,
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
                .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: white; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { padding: 30px 20px; }
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
                        
                        <h4>🎟️ Ticket Types</h4>
                        ${event.ticketTypes
                          .map(
                            (ticket) => `
                            <p><strong>${
                              ticket.name
                            }:</strong> ${formatCurrency(ticket.price)} (${
                              ticket.quantity
                            } available)</p>
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
                        <p>Your event is now live and ready for ticket sales! Start promoting your event to attract attendees.</p>
                    </div>
                    `
                    }
                    
                    <p>You can manage your event, track sales, and view analytics from your organizer dashboard.</p>
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

module.exports = {
  sendVerificationEmail,
  sendTicketConfirmation,
  sendRefundConfirmation,
  sendEventUpdateNotification,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendEventCreationNotification,
};
