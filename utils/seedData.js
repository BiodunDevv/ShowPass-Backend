require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const UserManager = require("./UserManager");
const Event = require("../models/Event");
const connectDB = require("../config/database");
const {
  sendWelcomeEmail,
  sendEventCreationNotification,
} = require("./emailService");

const seedData = async () => {
  try {
    // Connect to database
    await connectDB();

    console.log("🌱 Starting database seeding...");

    // Clear existing data
    const Admin = require("../models/Admin");
    const Organizer = require("../models/Organizer");
    const RegularUser = require("../models/RegularUser");

    await Admin.deleteMany({});
    await Organizer.deleteMany({});
    await RegularUser.deleteMany({});
    await Event.deleteMany({});
    console.log("🗑️  Cleared existing data");

    // Create Admin User
    const { user: adminUser } = await UserManager.createUser({
      firstName: process.env.ADMIN_FIRST_NAME || "Mustapha",
      lastName: process.env.ADMIN_LAST_NAME || "Muhammed",
      email: process.env.ADMIN_EMAIL || "mustapha.muhammed@bowen.edu.ng",
      password: process.env.ADMIN_PASSWORD || "Balikiss12",
      role: "admin",
      isVerified: true,
    });
    console.log("👑 Admin user created:", adminUser.email);

    // Send welcome email to admin
    try {
      await sendWelcomeEmail(adminUser);
      console.log("📧 Welcome email sent to admin");
    } catch (emailError) {
      console.log("⚠️  Welcome email failed for admin:", emailError.message);
    }

    // Create Organizer User
    const { user: organizerUser } = await UserManager.createUser({
      firstName: "Louis",
      lastName: "Diaz",
      email: process.env.ORGANIZER_EMAIL || "louisdiaz43@gmail.com",
      password: process.env.ORGANIZER_PASSWORD || "Balikiss12",
      role: "organizer",
      phone: "+2348123456789",
      isVerified: true,
    });
    console.log("🎯 Organizer user created:", organizerUser.email);

    // Send welcome email to organizer
    try {
      await sendWelcomeEmail(organizerUser);
      console.log("📧 Welcome email sent to organizer");
    } catch (emailError) {
      console.log(
        "⚠️  Welcome email failed for organizer:",
        emailError.message
      );
    }

    // Create Regular User
    const { user: regularUser } = await UserManager.createUser({
      firstName: "Muhammed",
      lastName: "Abiodun",
      email: process.env.USER_EMAIL || "muhammedabiodun42@gmail.com",
      password: process.env.USER_PASSWORD || "Balikiss12",
      role: "user",
      phone: "+2348087654321",
      isVerified: true,
    });
    console.log("👤 Regular user created:", regularUser.email);

    // Send welcome email to user
    try {
      await sendWelcomeEmail(regularUser);
      console.log("📧 Welcome email sent to user");
    } catch (emailError) {
      console.log("⚠️  Welcome email failed for user:", emailError.message);
    }

    console.log(`
✅ Database seeding completed successfully!

📊 Summary:
- Total users created: ${
      (await UserManager.getAllAdmins()).length +
      (await UserManager.getAllOrganizers()).length +
      (await UserManager.getAllRegularUsers()).length
    }
  - Admins: ${(await UserManager.getAllAdmins()).length}
  - Organizers: ${(await UserManager.getAllOrganizers()).length}
  - Regular Users: ${(await UserManager.getAllRegularUsers()).length}
- Events created: ${await Event.countDocuments()}

🔐 Default Login Credentials:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👑 Admin:
   Email: ${adminUser.email}
   Password: ${process.env.ADMIN_PASSWORD || "Balikiss12"}

🎯 Organizer:
   Email: ${organizerUser.email}
   Password: ${process.env.ORGANIZER_PASSWORD || "Balikiss12"}

👤 User:
   Email: ${regularUser.email}
   Password: ${process.env.USER_PASSWORD || "Balikiss12"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `);

    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
};

// Run seeding if this file is executed directly
if (require.main === module) {
  seedData();
}

module.exports = seedData;
