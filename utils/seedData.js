require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
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
    await User.deleteMany({});
    await Event.deleteMany({});
    console.log("🗑️  Cleared existing data");

    // Create Admin User
    const adminUser = new User({
      firstName: process.env.ADMIN_FIRST_NAME || "Mustapha",
      lastName: process.env.ADMIN_LAST_NAME || "Muhammed",
      email: process.env.ADMIN_EMAIL || "mustapha.muhammed@bowen.edu.ng",
      password: process.env.ADMIN_PASSWORD || "Balikiss12",
      role: "admin",
      isVerified: true,
    });
    await adminUser.save();
    console.log("👑 Admin user created:", adminUser.email);

    // Send welcome email to admin
    try {
      await sendWelcomeEmail(adminUser);
      console.log("📧 Welcome email sent to admin");
    } catch (emailError) {
      console.log("⚠️  Welcome email failed for admin:", emailError.message);
    }

    // Create Organizer User
    const organizerUser = new User({
      firstName: "Louis",
      lastName: "Diaz",
      email: process.env.ORGANIZER_EMAIL || "louisdiaz43@gmail.com",
      password: process.env.ORGANIZER_PASSWORD || "Balikiss12",
      role: "organizer",
      phone: "+2348123456789",
    });
    await organizerUser.save();
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
    const regularUser = new User({
      firstName: "Muhammed",
      lastName: "Abiodun",
      email: process.env.USER_EMAIL || "muhammedabiodun42@gmail.com",
      password: process.env.USER_PASSWORD || "Balikiss12",
      role: "user",
      phone: "+2348087654321",
    });
    await regularUser.save();
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
      const user = new User(userData);
      await user.save();
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
    const organizers = await User.find({ role: "organizer" });

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
    ];

    for (const eventData of sampleEvents) {
      const event = new Event(eventData);
      await event.save();
      console.log(`🎪 Event created: ${event.title}`);

      // Send event creation notification to organizer
      try {
        const organizer = await User.findById(event.organizer);
        if (organizer) {
          await sendEventCreationNotification(organizer, event);
          console.log(`📧 Event creation email sent to: ${organizer.email}`);
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
- Users created: ${await User.countDocuments()}
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
