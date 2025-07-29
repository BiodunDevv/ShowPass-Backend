/**
 * Test email notifications for user approvals
 */

require("dotenv").config();
const mongoose = require("mongoose");
const UserManager = require("./utils/UserManager");
const { sendEventApprovalNotification } = require("./utils/emailService");

async function testEmailNotifications() {
  try {
    console.log("🧪 Testing Email Notification System\n");

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to database");

    // Get all regular users
    const users = await UserManager.getAllRegularUsers();
    console.log(`\n👥 Found ${users.length} regular users:`);

    users.forEach((user, index) => {
      const notificationsEnabled = user.notifications?.newEvents !== false;
      console.log(`  ${index + 1}. ${user.firstName} ${user.lastName}`);
      console.log(`     📧 Email: ${user.email}`);
      console.log(
        `     🔔 Notifications: ${
          notificationsEnabled ? "✅ ENABLED" : "❌ DISABLED"
        }`
      );
      console.log("");
    });

    // Filter eligible users
    const eligibleUsers = users.filter(
      (user) => user.notifications?.newEvents !== false
    );
    console.log(
      `📊 ${eligibleUsers.length} out of ${users.length} users are eligible for notifications\n`
    );

    if (eligibleUsers.length === 0) {
      console.log("❌ No users eligible for notifications. Exiting...");
      process.exit(0);
    }

    // Create test event
    const testEvent = {
      _id: "64a1234567890abcdef12345",
      title: "Test Email Notification Event",
      description:
        "This is a test event to verify that users receive email notifications when events are approved.",
      category: "Technology",
      startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      startTime: "18:00",
      endTime: "21:00",
      venue: {
        name: "Test Venue for Email Notifications",
        city: "Lagos",
        address: "Test Address, Lagos",
      },
      ticketTypes: [
        { name: "Regular", price: 5000 },
        { name: "VIP", price: 15000 },
      ],
      isFreeEvent: false,
    };

    const testOrganizer = {
      firstName: "Test",
      lastName: "Organizer",
      email: "test.organizer@example.com",
    };

    console.log("📧 Attempting to send test email notifications...");
    console.log(`   Event: ${testEvent.title}`);
    console.log(
      `   Recipients: ${eligibleUsers.map((u) => u.email).join(", ")}`
    );
    console.log("");

    // Send the notification
    await sendEventApprovalNotification(
      eligibleUsers,
      testEvent,
      testOrganizer
    );

    console.log("✅ Email notifications sent successfully!");
    console.log("");
    console.log("📬 Please check the following email addresses:");
    eligibleUsers.forEach((user) => {
      console.log(`   📧 ${user.email}`);
    });

    console.log("\n💡 If you don't receive the email:");
    console.log("   1. Check your spam/junk folder");
    console.log("   2. Verify the email address is correct");
    console.log("   3. Check email service logs for delivery issues");
    console.log(
      "   4. Ensure your email provider allows emails from team.showpass@gmail.com"
    );
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error("Full error:", error);
  } finally {
    mongoose.disconnect();
    console.log("\n🔌 Disconnected from database");
  }
}

// Run the test
testEmailNotifications();
