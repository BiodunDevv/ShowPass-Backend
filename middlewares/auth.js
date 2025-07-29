const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Verify JWT token
const requireAuth = async (req, res, next) => {
  try {
    const token =
      req.header("Authorization")?.replace("Bearer ", "") || req.cookies?.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Token is not valid. User not found.",
      });
    }

    if (user.blocked) {
      return res.status(403).json({
        success: false,
        message: "Your account has been blocked. Please contact support.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token has expired. Please login again.",
      });
    }

    res.status(401).json({
      success: false,
      message: "Token is not valid.",
    });
  }
};

// Check if user has specific role
const hasRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Authentication required.",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(" or ")}`,
      });
    }

    next();
  };
};

// Specific role middlewares
const isUser = hasRole("user", "organizer", "admin");
const isOrganizer = hasRole("organizer", "admin");
const isAdmin = hasRole("admin");

// Check if user is verified
const requireVerified = (req, res, next) => {
  if (!req.user.isVerified) {
    return res.status(403).json({
      success: false,
      message: "Please verify your email address to access this feature.",
    });
  }
  next();
};

// Optional auth - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("-password");

      if (user && !user.blocked) {
        req.user = user;
      }
    }
  } catch (error) {
    // Silently fail for optional auth
  }
  next();
};

module.exports = {
  requireAuth,
  hasRole,
  isUser,
  isOrganizer,
  isAdmin,
  requireVerified,
  optionalAuth,
};
