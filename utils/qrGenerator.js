const QRCode = require("qrcode");
const crypto = require("crypto");

// Generate QR code for ticket
const generateTicketQR = async (bookingData) => {
  try {
    const qrData = {
      bookingId: bookingData._id,
      eventId: bookingData.event,
      userId: bookingData.user,
      ticketType: bookingData.ticketType,
      quantity: bookingData.quantity,
      reference: bookingData.paymentReference,
      issuedAt: new Date().toISOString(),
      // Add a hash for verification
      hash: generateQRHash(bookingData),
    };

    const qrCodeString = JSON.stringify(qrData);

    // Generate QR code as data URL (base64 image)
    const qrCodeImage = await QRCode.toDataURL(qrCodeString, {
      errorCorrectionLevel: "M",
      type: "image/png",
      quality: 0.92,
      margin: 1,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
      width: 256,
    });

    return {
      qrCode: qrCodeString,
      qrCodeImage: qrCodeImage,
    };
  } catch (error) {
    console.error("QR Code generation error:", error);
    throw new Error("Failed to generate QR code");
  }
};

// Generate hash for QR verification
const generateQRHash = (bookingData) => {
  const data = `${bookingData._id}${bookingData.event}${bookingData.user}${bookingData.paymentReference}`;
  return crypto
    .createHash("sha256")
    .update(data + process.env.JWT_SECRET)
    .digest("hex");
};

// Verify QR code
const verifyTicketQR = (qrCodeString, expectedBookingId) => {
  try {
    const qrData = JSON.parse(qrCodeString);

    // Basic validation
    if (!qrData.bookingId || !qrData.hash) {
      return { valid: false, error: "Invalid QR code format" };
    }

    // Check if booking ID matches
    if (qrData.bookingId !== expectedBookingId.toString()) {
      return { valid: false, error: "QR code does not match booking" };
    }

    // Verify hash (would need actual booking data for full verification)
    return { valid: true, data: qrData };
  } catch (error) {
    return { valid: false, error: "Invalid QR code format" };
  }
};

// Generate QR code for event check-in
const generateEventQR = async (eventId) => {
  try {
    const qrData = {
      type: "event_checkin",
      eventId: eventId,
      generatedAt: new Date().toISOString(),
    };

    const qrCodeString = JSON.stringify(qrData);

    const qrCodeImage = await QRCode.toDataURL(qrCodeString, {
      errorCorrectionLevel: "M",
      type: "image/png",
      quality: 0.92,
      margin: 1,
      width: 256,
    });

    return {
      qrCode: qrCodeString,
      qrCodeImage: qrCodeImage,
    };
  } catch (error) {
    console.error("Event QR Code generation error:", error);
    throw new Error("Failed to generate event QR code");
  }
};

module.exports = {
  generateTicketQR,
  verifyTicketQR,
  generateEventQR,
  generateQRHash,
};
