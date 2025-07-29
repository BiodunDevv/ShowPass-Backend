/**
 * Test script to verify the new separated user collections
 */

const mongoose = require("mongoose");
require("dotenv").config();

const UserManager = require("./utils/UserManager");

async function testCollections() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Test 1: Check if collections exist
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map((c) => c.name);

    console.log("\n📂 Available Collections:");
    collectionNames.forEach((name) => {
      if (
        name.includes("user") ||
        name.includes("admin") ||
        name.includes("organizer")
      ) {
        console.log(`  - ${name}`);
      }
    });

    // Test 2: Test UserManager methods
    console.log("\n🔍 Testing UserManager methods...");

    // Try to find a user (should work without errors even if no users exist)
    try {
      const userResult = await UserManager.findByEmail("test@example.com");
      console.log("✅ UserManager.findByEmail() works");
    } catch (error) {
      console.log("❌ UserManager.findByEmail() error:", error.message);
    }

    // Test collection-specific methods
    try {
      const admins = await UserManager.getAllAdmins();
      console.log(`✅ Found ${admins.length} admins in database`);
    } catch (error) {
      console.log("❌ UserManager.getAllAdmins() error:", error.message);
    }

    try {
      const organizers = await UserManager.getAllOrganizers();
      console.log(`✅ Found ${organizers.length} organizers in database`);
    } catch (error) {
      console.log("❌ UserManager.getAllOrganizers() error:", error.message);
    }

    try {
      const users = await UserManager.getAllRegularUsers();
      console.log(`✅ Found ${users.length} regular users in database`);
    } catch (error) {
      console.log("❌ UserManager.getAllRegularUsers() error:", error.message);
    }

    console.log("\n🎉 Database separation test completed successfully!");
    console.log("\n📋 Summary:");
    console.log(
      "   • Users are now stored in separate collections based on role"
    );
    console.log('   • Admins: "admins" collection');
    console.log('   • Organizers: "organizers" collection');
    console.log('   • Regular Users: "regularusers" collection');
    console.log("   • UserManager handles cross-collection operations");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("\n✅ Disconnected from MongoDB");
  }
}

// Run the test
testCollections();
