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

    // Create Additional Users
    const additionalUsers = [
      {
        firstName: "Sarah",
        lastName: "Johnson",
        email: "sarah.johnson@example.com",
        password: "Password123",
        role: "organizer",
        isVerified: true,
      },
      {
        firstName: "David",
        lastName: "Williams",
        email: "david.williams@example.com",
        password: "Password123",
        role: "user",
        isVerified: true,
      },
      {
        firstName: "Emily",
        lastName: "Brown",
        email: "emily.brown@example.com",
        password: "Password123",
        role: "user",
        isVerified: true,
      },
    ];

    for (const userData of additionalUsers) {
      const { user } = await UserManager.createUser(userData);
      console.log(`👥 User created: ${user.email}`);

      // Send welcome email to additional user
      try {
        await sendWelcomeEmail(user);
        console.log(`📧 Welcome email sent to: ${user.email}`);
      } catch (emailError) {
        console.log(
          `⚠️  Welcome email failed for ${user.email}:`,
          emailError.message
        );
      }
    }

    // Get all organizers for event creation
    const organizers = await UserManager.getAllOrganizers();

    // Create Sample Events
    const sampleEvents = [
      {
        title: "Tech Conference Lagos 2024",
        description:
          "Join the biggest technology conference in West Africa. Featuring speakers from Google, Microsoft, and leading African tech companies. Learn about AI, blockchain, and the future of technology in Africa.",
        organizer: organizers[0]._id,
        category: "Technology",
        venue: {
          name: "Eko Convention Centre",
          address: "Plot 1, Water Corporation Drive, Victoria Island",
          city: "Lagos",
          state: "Lagos",
          coordinates: {
            latitude: 6.4474,
            longitude: 3.4192,
          },
        },
        startDate: new Date("2024-12-15T09:00:00"),
        endDate: new Date("2024-12-15T18:00:00"),
        startTime: "09:00",
        endTime: "18:00",
        ticketTypes: [
          {
            name: "Regular",
            price: 15000,
            quantity: 200,
            description: "General admission with access to all sessions",
            benefits: [
              "Access to all sessions",
              "Networking lunch",
              "Certificate of attendance",
            ],
          },
          {
            name: "VIP",
            price: 35000,
            quantity: 50,
            description: "VIP access with premium benefits",
            benefits: [
              "All Regular benefits",
              "VIP seating",
              "Meet & greet with speakers",
              "Welcome gift",
            ],
          },
        ],
        approved: true,
        status: "approved",
        approvedBy: adminUser._id,
        approvedAt: new Date(),
        featured: true,
        tags: ["technology", "conference", "AI", "blockchain", "networking"],
      },
      {
        title: "Afrobeats Music Festival",
        description:
          "Experience the best of Afrobeats music with top artists from Nigeria and across Africa. A night of amazing music, food, and culture.",
        organizer: organizers[1]._id,
        category: "Music",
        venue: {
          name: "Tafawa Balewa Square",
          address: "Tafawa Balewa Square, Lagos Island",
          city: "Lagos",
          state: "Lagos",
        },
        startDate: new Date("2024-12-20T19:00:00"),
        endDate: new Date("2024-12-21T02:00:00"),
        startTime: "19:00",
        endTime: "02:00",
        ticketTypes: [
          {
            name: "Regular",
            price: 8000,
            quantity: 500,
            description: "General admission",
          },
          {
            name: "VIP",
            price: 25000,
            quantity: 100,
            description: "VIP section with premium viewing",
          },
        ],
        approved: true,
        status: "approved",
        approvedBy: adminUser._id,
        approvedAt: new Date(),
        featured: true,
        tags: ["music", "afrobeats", "festival", "entertainment"],
      },
      {
        title: "Digital Marketing Workshop",
        description:
          "Learn the latest digital marketing strategies from industry experts. Perfect for entrepreneurs, marketers, and business owners.",
        organizer: organizers[0]._id,
        category: "Business",
        venue: {
          name: "Landmark Centre",
          address: "Plot 2 & 3, Water Corporation Road, Victoria Island",
          city: "Lagos",
          state: "Lagos",
        },
        startDate: new Date("2024-11-30T10:00:00"),
        endDate: new Date("2024-11-30T16:00:00"),
        startTime: "10:00",
        endTime: "16:00",
        ticketTypes: [
          {
            name: "Standard",
            price: 12000,
            quantity: 80,
            description: "Workshop access and materials",
          },
          {
            name: "Premium",
            price: 20000,
            quantity: 20,
            description: "Standard + 1-on-1 consultation session",
          },
        ],
        status: "pending",
        tags: ["marketing", "workshop", "business", "digital"],
      },
      {
        title: "Art Exhibition: Contemporary Nigerian Art",
        description:
          "Discover the works of emerging and established Nigerian artists in this curated exhibition showcasing contemporary art.",
        organizer: organizers[1]._id,
        category: "Arts",
        venue: {
          name: "Nike Art Gallery",
          address: "3, Elegushi Beach Road, Lekki Phase 1",
          city: "Lagos",
          state: "Lagos",
        },
        startDate: new Date("2024-12-05T11:00:00"),
        endDate: new Date("2024-12-05T19:00:00"),
        startTime: "11:00",
        endTime: "19:00",
        ticketTypes: [
          {
            name: "Regular",
            price: 3000,
            quantity: 150,
            description: "Exhibition access",
          },
        ],
        approved: true,
        status: "approved",
        approvedBy: adminUser._id,
        approvedAt: new Date(),
        tags: ["art", "exhibition", "culture", "gallery"],
      },
      {
        title: "Food Festival Lagos",
        description:
          "Taste the best of Nigerian and international cuisine from top chefs and restaurants. Family-friendly event with live cooking demonstrations.",
        organizer: organizers[0]._id,
        category: "Food",
        venue: {
          name: "Landmark Beach",
          address: "Landmark Beach, Oniru, Victoria Island",
          city: "Lagos",
          state: "Lagos",
        },
        startDate: new Date("2024-12-10T12:00:00"),
        endDate: new Date("2024-12-10T20:00:00"),
        startTime: "12:00",
        endTime: "20:00",
        ticketTypes: [
          {
            name: "Regular",
            price: 5000,
            quantity: 300,
            description: "Festival access and one meal voucher",
          },
          {
            name: "Premium",
            price: 12000,
            quantity: 100,
            description: "Premium access with multiple meal vouchers",
          },
        ],
        approved: true,
        status: "approved",
        approvedBy: adminUser._id,
        approvedAt: new Date(),
        tags: ["food", "festival", "cuisine", "family"],
      },
      {
        title: "Free Community Meetup",
        description:
          "Join our free community meetup to network with like-minded individuals in the tech space. No payment required - just bring your enthusiasm!",
        organizer: organizers[0]._id,
        category: "Technology",
        venue: {
          name: "Co-Creation Hub",
          address: "294 Herbert Macaulay Way, Sabo, Yaba",
          city: "Lagos",
          state: "Lagos",
        },
        startDate: new Date("2024-11-25T18:00:00"),
        endDate: new Date("2024-11-25T21:00:00"),
        startTime: "18:00",
        endTime: "21:00",
        ticketTypes: [
          {
            name: "Free",
            price: 0,
            quantity: 100,
            description: "Free admission - no payment required",
            isFree: true,
          },
        ],
        approved: true,
        status: "approved",
        approvedBy: adminUser._id,
        approvedAt: new Date(),
        isFreeEvent: true,
        tags: ["free", "networking", "community", "tech"],
      },
      {
        title: "Open Art Gallery Night",
        description:
          "Free art gallery event showcasing local artists. Come and enjoy art, music, and refreshments at no cost!",
        organizer: organizers[1]._id,
        category: "Arts",
        venue: {
          name: "National Theatre",
          address: "National Arts Theatre, Iganmu",
          city: "Lagos",
          state: "Lagos",
        },
        startDate: new Date("2024-12-01T19:00:00"),
        endDate: new Date("2024-12-01T23:00:00"),
        startTime: "19:00",
        endTime: "23:00",
        ticketTypes: [
          {
            name: "Free",
            price: 0,
            quantity: 200,
            description: "Free entry to gallery night",
            isFree: true,
          },
        ],
        status: "pending",
        isFreeEvent: true,
        tags: ["free", "art", "gallery", "culture"],
      },
    ];

    for (const eventData of sampleEvents) {
      const event = new Event(eventData);
      await event.save();

      // Update organizer's created events array using UserManager
      await UserManager.updateUserEventArrays(
        event.organizer,
        event._id,
        "created"
      );

      // If approved, update admin's approved events array
      if (event.approved && event.approvedBy) {
        await UserManager.updateUserEventArrays(
          event.approvedBy,
          event._id,
          "approved"
        );
      }

      console.log(`🎪 Event created: ${event.title}`);

      // Send event creation notification to organizer
      try {
        const organizerResult = await UserManager.findById(event.organizer);
        if (organizerResult) {
          await sendEventCreationNotification(organizerResult.user, event);
          console.log(
            `📧 Event creation email sent to: ${organizerResult.user.email}`
          );
        }
      } catch (emailError) {
        console.log(
          `⚠️  Event creation email failed for ${event.title}:`,
          emailError.message
        );
      }
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
