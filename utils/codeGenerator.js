const crypto = require("crypto");

// Generate a 10-digit verification code
const generateVerificationCode = () => {
  // Generate a random 10-digit code
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
};

// Generate multiple unique verification codes
const generateVerificationCodes = (quantity) => {
  const codes = new Set();

  while (codes.size < quantity) {
    codes.add(generateVerificationCode());
  }

  return Array.from(codes);
};

// Generate hash for code verification (security)
const generateCodeHash = (bookingData, code) => {
  const data = `${bookingData._id}${bookingData.event}${bookingData.user}${code}${bookingData.paymentReference}`;
  return crypto
    .createHash("sha256")
    .update(data + process.env.JWT_SECRET)
    .digest("hex");
};

// Verify code hash
const verifyCodeHash = (bookingData, code, hash) => {
  const expectedHash = generateCodeHash(bookingData, code);
  return expectedHash === hash;
};

module.exports = {
  generateVerificationCode,
  generateVerificationCodes,
  generateCodeHash,
  verifyCodeHash,
};
