const axios = require("axios");

async function testEmailScenarios() {
  try {
    console.log("🔐 Testing Email Scenarios...");

    // Login
    const loginResponse = await axios.post(
      "http://localhost:3001/api/auth/login",
      {
        email: "muhammedabiodun42@gmail.com",
        password: "Balikiss12",
      }
    );

    const token = loginResponse.data.data.token;
    const user = loginResponse.data.data.user;

    console.log("✅ Login successful!");
    console.log("User:", user.email);

    // Get events
    const eventsResponse = await axios.get("http://localhost:3001/api/events");
    const paidEvent = eventsResponse.data.data.find(
      (event) => !event.isFreeEvent
    );

    if (!paidEvent) {
      console.log("❌ No paid events found");
      return;
    }

    console.log("📅 Using event:", paidEvent.title);

    // Test Scenario 1: User books ticket for themselves (same email)
    console.log(
      "\n📧 Scenario 1: User books for themselves (should get 1 email)"
    );
    try {
      const booking1Response = await axios.post(
        "http://localhost:3001/api/booking",
        {
          eventId: paidEvent.id,
          ticketType: "Regular",
          quantity: 1,
          frontendPaymentId: `self_booking_${Date.now()}`,
          attendeeInfo: [
            {
              name: user.firstName + " " + user.lastName,
              email: user.email, // Same as account owner
              phone: "+2348123456789",
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

      console.log(
        "✅ Self-booking successful! Booking ID:",
        booking1Response.data.data._id
      );
      console.log("Expected: 1 email to user (receipt)");
    } catch (error) {
      console.log(
        "❌ Self-booking failed:",
        error.response?.data?.message || error.message
      );
    }

    // Wait a bit before next test
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Test Scenario 2: User books ticket for someone else (different email)
    console.log(
      "\n📧 Scenario 2: User books for someone else (should get 2 emails)"
    );
    try {
      const booking2Response = await axios.post(
        "http://localhost:3001/api/booking",
        {
          eventId: paidEvent.id,
          ticketType: "Regular",
          quantity: 1,
          frontendPaymentId: `other_booking_${Date.now()}`,
          attendeeInfo: [
            {
              name: "Jane Smith",
              email: "jane.smith@example.com", // Different from account owner
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

      console.log(
        "✅ Other-person booking successful! Booking ID:",
        booking2Response.data.data._id
      );
      console.log("Expected: 1 confirmation to user + 1 ticket to attendee");
    } catch (error) {
      console.log(
        "❌ Other-person booking failed:",
        error.response?.data?.message || error.message
      );
    }

    // Wait a bit before next test
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Test Scenario 3: Mixed booking (user + others)
    console.log(
      "\n📧 Scenario 3: Mixed booking - user + others (should optimize emails)"
    );
    try {
      const booking3Response = await axios.post(
        "http://localhost:3001/api/booking",
        {
          eventId: paidEvent.id,
          ticketType: "Regular",
          quantity: 3,
          frontendPaymentId: `mixed_booking_${Date.now()}`,
          attendeeInfo: [
            {
              name: user.firstName + " " + user.lastName,
              email: user.email, // Same as account owner
              phone: "+2348123456789",
            },
            {
              name: "John Doe",
              email: "john.doe@example.com", // Different
              phone: "+2348111111111",
            },
            {
              name: "Alice Johnson",
              email: "alice.johnson@example.com", // Different
              phone: "+2348222222222",
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

      console.log(
        "✅ Mixed booking successful! Booking ID:",
        booking3Response.data.data._id
      );
      console.log("Expected: 1 receipt to user + 2 tickets to other attendees");
    } catch (error) {
      console.log(
        "❌ Mixed booking failed:",
        error.response?.data?.message || error.message
      );
    }

    console.log("\n🎯 Check server logs to see email sending behavior!");
  } catch (error) {
    console.log(
      "❌ Test failed:",
      error.response?.data?.message || error.message
    );
  }
}

testEmailScenarios();
