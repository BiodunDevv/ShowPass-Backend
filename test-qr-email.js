const { generateTicketQR } = require("./utils/qrGenerator");
const { sendTicketConfirmation } = require("./utils/emailService");

async function testQREmail() {
  try {
    console.log("🧪 Testing QR Code Email Generation...");

    // Mock booking data
    const mockBooking = {
      _id: "507f1f77bcf86cd799439011",
      event: "507f1f77bcf86cd799439012",
      user: "507f1f77bcf86cd799439013",
      ticketType: "General Admission",
      quantity: 1,
      finalAmount: 5000,
      paymentReference: "TEST_REF_" + Date.now(),
    };

    // Mock user data
    const mockUser = {
      firstName: "Test",
      email: "test@example.com",
    };

    // Mock event data
    const mockEvent = {
      title: "Test Event",
      startDate: new Date(),
      startTime: "19:00",
      endTime: "23:00",
      venue: {
        name: "Test Venue",
        address: "Test Address, Test City",
      },
    };

    // Generate QR code
    console.log("📱 Generating QR Code...");
    const { qrCode, qrCodeImage } = await generateTicketQR(mockBooking);
    console.log("✅ QR Code generated successfully");
    console.log("📊 QR Code format:", qrCodeImage.substring(0, 50) + "...");

    // Test email sending
    console.log("📧 Sending test email...");
    await sendTicketConfirmation(mockUser, mockBooking, mockEvent, qrCodeImage);
    console.log("✅ Email sent successfully!");

    console.log("🎉 QR Code email test completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  testQREmail()
    .then(() => {
      console.log("Test completed. Exiting...");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Test failed:", error);
      process.exit(1);
    });
}

module.exports = { testQREmail };
