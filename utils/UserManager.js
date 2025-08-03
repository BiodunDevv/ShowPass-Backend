const RegularUser = require("../models/RegularUser");
const Organizer = require("../models/Organizer");
const Admin = require("../models/Admin");

class UserManager {
  // Get user model based on role
  static getUserModel(role) {
    switch (role) {
      case "user":
        return RegularUser;
      case "organizer":
        return Organizer;
      case "admin":
        return Admin;
      default:
        throw new Error(`Invalid user role: ${role}`);
    }
  }

  // Find user by email across all collections
  static async findByEmail(email) {
    // Try to find in each collection
    let user = await RegularUser.findOne({ email });
    if (user) return { user, model: RegularUser, role: "user" };

    user = await Organizer.findOne({ email });
    if (user) return { user, model: Organizer, role: "organizer" };

    user = await Admin.findOne({ email });
    if (user) return { user, model: Admin, role: "admin" };

    return null;
  }

  // Find user by verification code across all collections
  static async findByVerificationCode(code) {
    // Try to find in each collection
    let user = await RegularUser.findOne({
      verificationCode: code,
      verificationCodeExpires: { $gt: new Date() },
    });
    if (user) return { user, model: RegularUser, role: "user" };

    user = await Organizer.findOne({
      verificationCode: code,
      verificationCodeExpires: { $gt: new Date() },
    });
    if (user) return { user, model: Organizer, role: "organizer" };

    user = await Admin.findOne({
      verificationCode: code,
      verificationCodeExpires: { $gt: new Date() },
    });
    if (user) return { user, model: Admin, role: "admin" };

    return null;
  }

  // Find user by verification token across all collections (legacy support)
  static async findByVerificationToken(token) {
    // Try to find in each collection
    let user = await RegularUser.findOne({ verificationToken: token });
    if (user) return { user, model: RegularUser, role: "user" };

    user = await Organizer.findOne({ verificationToken: token });
    if (user) return { user, model: Organizer, role: "organizer" };

    user = await Admin.findOne({ verificationToken: token });
    if (user) return { user, model: Admin, role: "admin" };

    return null;
  }

  // Find user by reset password token across all collections
  static async findByResetToken(token) {
    // Try to find in each collection
    let user = await RegularUser.findOne({
      resetPasswordToken: token,
      resetPasswordExpire: { $gt: Date.now() },
    });
    if (user) return { user, model: RegularUser, role: "user" };

    user = await Organizer.findOne({
      resetPasswordToken: token,
      resetPasswordExpire: { $gt: Date.now() },
    });
    if (user) return { user, model: Organizer, role: "organizer" };

    user = await Admin.findOne({
      resetPasswordToken: token,
      resetPasswordExpire: { $gt: Date.now() },
    });
    if (user) return { user, model: Admin, role: "admin" };

    return null;
  }

  // Find user by ID across all collections
  static async findById(id) {
    // Try to find in each collection
    let user = await RegularUser.findById(id);
    if (user) return { user, model: RegularUser, role: "user" };

    user = await Organizer.findById(id);
    if (user) return { user, model: Organizer, role: "organizer" };

    user = await Admin.findById(id);
    if (user) return { user, model: Admin, role: "admin" };

    return null;
  }

  // Create user in appropriate collection
  static async createUser(userData) {
    const { role } = userData;
    const UserModel = this.getUserModel(role);

    // Remove role from userData for clean insertion
    const { role: _, ...cleanUserData } = userData;

    const user = new UserModel(cleanUserData);
    await user.save();

    return { user, model: UserModel, role };
  }

  // Update user event arrays
  static async updateUserEventArrays(userId, eventId, action) {
    const userResult = await this.findById(userId);
    if (!userResult) return false;

    const { user, model } = userResult;
    let updateOperation = {};

    switch (action) {
      case "created":
        if (user.role === "organizer") {
          updateOperation = { $addToSet: { createdEvents: eventId } };
        }
        break;
      case "approved":
        if (user.role === "admin") {
          updateOperation = { $addToSet: { approvedEvents: eventId } };
        }
        break;
      case "attending":
        updateOperation = { $addToSet: { attendingEvents: eventId } };
        break;
      case "remove_created":
        if (user.role === "organizer") {
          updateOperation = { $pull: { createdEvents: eventId } };
        }
        break;
      case "remove_approved":
        if (user.role === "admin") {
          updateOperation = { $pull: { approvedEvents: eventId } };
        }
        break;
      case "remove_attending":
        updateOperation = { $pull: { attendingEvents: eventId } };
        break;
      default:
        return false;
    }

    if (Object.keys(updateOperation).length === 0) return false;

    await model.findByIdAndUpdate(userId, updateOperation);
    return true;
  }

  // Get all users of a specific role
  static async getUsersByRole(role, query = {}, options = {}) {
    const UserModel = this.getUserModel(role);
    return await UserModel.find(query, null, options);
  }

  // Get all admins
  static async getAllAdmins(query = {}) {
    return await Admin.find(query);
  }

  // Get all organizers
  static async getAllOrganizers(query = {}) {
    return await Organizer.find(query);
  }

  // Get all regular users
  static async getAllRegularUsers(query = {}) {
    return await RegularUser.find(query);
  }

  // Get users for notifications (all regular users with notifications enabled)
  static async getUsersForNotifications() {
    return await RegularUser.find({
      "notifications.email": true,
      "notifications.newEvents": true,
      blocked: false,
    });
  }

  // Count users by role
  static async countUsersByRole() {
    const [adminCount, organizerCount, userCount] = await Promise.all([
      Admin.countDocuments(),
      Organizer.countDocuments(),
      RegularUser.countDocuments(),
    ]);

    return {
      admins: adminCount,
      organizers: organizerCount,
      users: userCount,
      total: adminCount + organizerCount + userCount,
    };
  }

  // Search users across all collections
  static async searchUsers(searchTerm, role = null) {
    const searchQuery = {
      $or: [
        { firstName: new RegExp(searchTerm, "i") },
        { lastName: new RegExp(searchTerm, "i") },
        { email: new RegExp(searchTerm, "i") },
      ],
    };

    if (role) {
      const UserModel = this.getUserModel(role);
      return await UserModel.find(searchQuery);
    }

    // Search across all collections
    const [users, organizers, admins] = await Promise.all([
      RegularUser.find(searchQuery),
      Organizer.find(searchQuery),
      Admin.find(searchQuery),
    ]);

    return {
      users: users.map((u) => ({ ...u.toObject(), role: "user" })),
      organizers: organizers.map((u) => ({
        ...u.toObject(),
        role: "organizer",
      })),
      admins: admins.map((u) => ({ ...u.toObject(), role: "admin" })),
    };
  }

  // Update user in appropriate collection
  static async updateUser(userId, updateData) {
    const userResult = await this.findById(userId);
    if (!userResult) return null;

    const { user, model } = userResult;
    return await model.findByIdAndUpdate(userId, updateData, { new: true });
  }

  // Delete user from appropriate collection
  static async deleteUser(userId) {
    const userResult = await this.findById(userId);
    if (!userResult) return false;

    const { model } = userResult;
    await model.findByIdAndDelete(userId);
    return true;
  }

  // Migrate existing users to new collections (utility function)
  static async migrateExistingUsers() {
    const User = require("../models/User"); // Old user model

    try {
      const allUsers = await User.find();

      for (const oldUser of allUsers) {
        const userData = oldUser.toObject();
        delete userData._id;
        delete userData.__v;

        await this.createUser(userData);
        console.log(`Migrated ${userData.role}: ${userData.email}`);
      }

      console.log(`Migration completed: ${allUsers.length} users migrated`);
      return true;
    } catch (error) {
      console.error("Migration failed:", error);
      return false;
    }
  }

  // Get all users across collections with filtering and pagination
  static async getAllUsers(query = {}, options = {}) {
    const {
      skip = 0,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = options;

    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    try {
      const [regularUsers, organizers, admins] = await Promise.all([
        RegularUser.find(query).sort(sort).skip(skip).limit(limit).lean(),
        Organizer.find(query).sort(sort).skip(skip).limit(limit).lean(),
        Admin.find(query).sort(sort).skip(skip).limit(limit).lean(),
      ]);

      // Add role property to each user
      const allUsers = [
        ...regularUsers.map((user) => ({ ...user, role: "user" })),
        ...organizers.map((user) => ({ ...user, role: "organizer" })),
        ...admins.map((user) => ({ ...user, role: "admin" })),
      ];

      // Sort the combined results
      allUsers.sort((a, b) => {
        const aValue = a[sortBy];
        const bValue = b[sortBy];
        if (sortOrder === "desc") {
          return bValue > aValue ? 1 : -1;
        } else {
          return aValue > bValue ? 1 : -1;
        }
      });

      return allUsers.slice(0, limit);
    } catch (error) {
      console.error("Get all users error:", error);
      throw error;
    }
  }

  // Get total count of users across all collections
  static async getTotalUsersCount(query = {}) {
    const [regularUsersCount, organizersCount, adminsCount] = await Promise.all(
      [
        RegularUser.countDocuments(query),
        Organizer.countDocuments(query),
        Admin.countDocuments(query),
      ]
    );

    return regularUsersCount + organizersCount + adminsCount;
  }
}

module.exports = UserManager;
