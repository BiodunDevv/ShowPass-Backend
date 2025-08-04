const axios = require("axios");

async function testBookingSystem() {
  try {
    console.log("🔐 Testing Authentication...");

    // Test login
    const loginResponse = await axios.post(
      "http://localhost:3001/api/auth/login",
      {
        email: "muhammedabiodun42@gmail.com",
        password: "Balikiss12",
      }
    );

    console.log("✅ Login successful!");
    console.log("User:", loginResponse.data.user.email);
    console.log("Token length:", loginResponse.data.token.length);

    const token = loginResponse.data.token;
    const userId = loginResponse.data.user.id;

    // Test getting events
    console.log("\n📅 Getting events...");
    const eventsResponse = await axios.get("http://localhost:3001/api/events");
    const events = eventsResponse.data.data;
    console.log(`Found ${events.length} events`);

    // Find a free event
    const freeEvent = events.find((event) => event.isFreeEvent);
    const paidEvent = events.find((event) => !event.isFreeEvent);

    if (freeEvent) {
      console.log(`Free event found: ${freeEvent.title} (ID: ${freeEvent.id})`);

      // Test free event registration
      console.log("\n🎟️ Testing free event registration...");
      try {
        const freeBookingResponse = await axios.post(
          "http://localhost:3001/api/booking/free-event",
          {
            eventId: freeEvent.id,
            attendeeInfo: [
              {
                name: "Test User One",
                email: "testuser1@example.com",
                phone: "+2348123456789",
              },
              {
                name: "Test User Two",
                email: "testuser2@example.com",
                phone: "+2348987654321",
              },
            ],
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        console.log("✅ Free event registration successful!");
        console.log("Booking ID:", freeBookingResponse.data.data.id);
        console.log(
          "Attendees:",
          freeBookingResponse.data.data.attendeeInfo.length
        );
        console.log(
          "Email status:",
          freeBookingResponse.data.message.includes("email")
            ? "Emails sent"
            : "Check email status"
        );
      } catch (freeError) {
        console.log("❌ Free event registration failed:");
        console.log("Status:", freeError.response?.status);
        console.log(
          "Error:",
          freeError.response?.data?.message || freeError.message
        );
      }
    } else {
      console.log("No free events found");
    }

    if (paidEvent) {
      console.log(
        `\nPaid event found: ${paidEvent.title} (ID: ${paidEvent.id})`
      );
      console.log(
        "Available ticket types:",
        paidEvent.ticketTypes.map((t) => `${t.name} - ₦${t.price}`).join(", ")
      );
    }
  } catch (error) {
    console.log(
      "❌ Test failed:",
      error.response?.data?.message || error.message
    );
  }
}

testBookingSystem();
