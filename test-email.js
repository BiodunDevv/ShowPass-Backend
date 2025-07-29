require("dotenv").config();
const nodemailer = require("nodemailer");

const testEmailConnection = async () => {
  console.log("🔧 Testing Gmail SMTP connection...");

  // Log the email credentials (without showing the full password)
  console.log("📧 Email User:", process.env.EMAIL_USER);
  console.log(
    "🔑 Email Password (first 4 chars):",
    process.env.EMAIL_PASS?.substring(0, 4) + "..."
  );

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  try {
    // Test connection
    await transporter.verify();
    console.log("✅ Gmail SMTP connection successful!");

    // Try sending a test email
    const testMailOptions = {
      from: process.env.EMAIL_FROM,
      to: process.env.EMAIL_USER, // Send to yourself
      subject: "ShowPass Email Test",
      text: "This is a test email from ShowPass to verify email functionality.",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #667eea; color: white; padding: 20px; text-align: center;">
            <h1>🎟️ ShowPass Email Test</h1>
          </div>
          <div style="padding: 20px;">
            <h2>Email Test Successful!</h2>
            <p>This email confirms that your Gmail SMTP configuration is working correctly.</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(testMailOptions);
    console.log("✅ Test email sent successfully!");
  } catch (error) {
    console.error("❌ Gmail SMTP connection failed:", error.message);

    if (error.responseCode === 535) {
      console.log(`
⚠️  Gmail Authentication Error - Follow these steps:

1. Enable 2-Factor Authentication on your Gmail account
2. Go to: https://myaccount.google.com/apppasswords
3. Generate a new App Password for "Mail"
4. Replace EMAIL_PASS in your .env file with the new 16-character App Password
5. Make sure you're using the App Password, not your regular Gmail password

Current configuration:
- EMAIL_USER: ${process.env.EMAIL_USER}
- EMAIL_PASS: ${process.env.EMAIL_PASS?.substring(0, 4)}... (${
        process.env.EMAIL_PASS?.length
      } characters)

The App Password should be 16 characters without spaces.
      `);
    }
  }

  process.exit(0);
};

testEmailConnection();
