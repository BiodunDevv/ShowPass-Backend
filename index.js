require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/database");

const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// Start server
app.listen(PORT, () => {
  console.log(`
🎟️ ShowPass Backend Server Running!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌐 Server: http://localhost:${PORT}
📊 Environment: ${process.env.NODE_ENV}
🗄️  Database: ${process.env.MONGODB_URI ? "Connected" : "Not configured"}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
});
