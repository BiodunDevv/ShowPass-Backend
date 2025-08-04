const axios = require("axios");

async function testAuthentication() {
  try {
    console.log("🔐 Testing Login...");

    // Test login with known user
    const loginResponse = await axios.post(
      "http://localhost:3001/api/auth/login",
      {
        email: "muhammedabiodun42@gmail.com",
        password: "Balikiss12",
      }
    );

    console.log("✅ Login successful!");
    console.log("Response data:", JSON.stringify(loginResponse.data, null, 2));

    if (!loginResponse.data.data || !loginResponse.data.data.user) {
      throw new Error("No user data in login response");
    }

    console.log("User:", loginResponse.data.data.user.email);
    console.log("User ID:", loginResponse.data.data.user._id);
    console.log(
      "Token received:",
      loginResponse.data.data.token ? "Yes" : "No"
    );

    const token = loginResponse.data.data.token;
    const userId = loginResponse.data.data.user._id;

    return { token, userId, user: loginResponse.data.data.user };
  } catch (error) {
    console.log("❌ Authentication test failed:");
    console.log("Status:", error.response?.status);
    console.log("Error:", error.response?.data?.message || error.message);
    return null;
  }
}

async function testBookingWithAuth() {
  const authResult = await testAuthentication();
  if (!authResult) {
    console.log("❌ Cannot proceed with booking test - authentication failed");
    return;
  }

  const { token, user } = authResult;

  try {
    console.log("\n📅 Getting events for booking test...");
    const eventsResponse = await axios.get("http://localhost:3001/api/events");
    const events = eventsResponse.data.data;
    const paidEvent = events.find((event) => !event.isFreeEvent);

    if (!paidEvent) {
      console.log("❌ No paid events found for testing");
      return;
    }

    console.log(`Found paid event: ${paidEvent.title} (ID: ${paidEvent.id})`);

    // Test paid booking with multiple attendees
    console.log("\n💳 Testing paid event booking...");
    const bookingResponse = await axios.post(
      "http://localhost:3001/api/booking",
      {
        eventId: paidEvent.id,
        ticketType: "Regular",
        quantity: 2,
        frontendPaymentId: `test_payment_${Date.now()}`,
        attendeeInfo: [
          {
            name: "John Doe",
            email: "john.doe@example.com", // Different from account owner
            phone: "+2348123456789",
          },
          {
            name: user.firstName + " " + user.lastName,
            email: user.email, // Same as account owner
            phone: user.phone || "+2348987654321",
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

    console.log("✅ Booking successful!");
    console.log("Booking ID:", bookingResponse.data.data.id);
    console.log("Attendees:", bookingResponse.data.data.attendeeInfo.length);
    console.log("Total Amount:", bookingResponse.data.data.finalAmount);
  } catch (error) {
    console.log("❌ Booking test failed:");
    console.log("Status:", error.response?.status);
    console.log("Error:", error.response?.data?.message || error.message);
    console.log("Full error:", error.response?.data);
  }
}

testBookingWithAuth();
