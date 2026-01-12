const Notification = require("../../../models/Notification");
const NotificationRecipient = require("../../../models/NotificationRecipient");
const NotificationPreference = require("../../../models/NotificationPreference");
const AppError = require("../../../utils/appError");

class NotificationService {
  /**
   * Create a notification and recipients
   * @param {Object} notificationData - Notification data
   * @param {Array} recipients - Array of { userId, channels }
   * @returns {Promise<Object>} Created notification with recipients
   */
  static async createNotification(notificationData, recipients = []) {
    if (!recipients || recipients.length === 0) {
      throw new AppError("At least one recipient is required", 400);
    }

    // Create notification
    const notification = await Notification.create(notificationData);

    // Get user preferences to determine channels
    const recipientPromises = recipients.map(async (recipient) => {
      const { userId, channels } = recipient;

      // Get user preferences
      const preferences = await NotificationPreference.findOne({ userId }).lean();
      
      // Determine which channels to use
      let finalChannels = channels || ["IN_APP"];
      
      // If channels not specified, use preferences
      if (!channels || channels.length === 0) {
        finalChannels = [];
        if (preferences?.inAppEnabled !== false) {
          finalChannels.push("IN_APP");
        }
        if (preferences?.emailEnabled === true) {
          finalChannels.push("EMAIL");
        }
        if (preferences?.smsEnabled === true) {
          finalChannels.push("SMS");
        }
        // Default to IN_APP if no preferences set
        if (finalChannels.length === 0) {
          finalChannels = ["IN_APP"];
        }
      }

      // Check if notification type is muted
      if (preferences?.mutedTypes?.includes(notificationData.type)) {
        // Skip this recipient if type is muted
        return null;
      }

      // Create recipients for each channel
      return finalChannels.map((channel) => ({
        notificationId: notification._id,
        userId,
        channel,
        deliveryStatus: channel === "IN_APP" ? "DELIVERED" : "PENDING",
        deliveredAt: channel === "IN_APP" ? new Date() : null,
      }));
    });

    const recipientArrays = await Promise.all(recipientPromises);
    const allRecipients = recipientArrays
      .filter(Boolean)
      .flat()
      .filter(Boolean);

    if (allRecipients.length > 0) {
      await NotificationRecipient.insertMany(allRecipients);
    }

    return notification.toObject();
  }

  /**
   * Get notifications for a user
   * @param {String} userId - User ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Notifications and total count
   */
  static async getNotifications(userId, filters = {}) {
    const {
      isRead,
      type,
      priority,
      limit = 50,
      offset = 0,
      search,
      dateFrom,
      dateTo,
    } = filters;

    // Build query for recipients
    const recipientQuery = {
      userId,
      archivedAt: null,
    };

    if (isRead !== undefined) {
      if (isRead === true) {
        recipientQuery.readAt = { $ne: null };
      } else {
        recipientQuery.readAt = null;
      }
    }

    // Get recipient IDs matching the query
    const recipients = await NotificationRecipient.find(recipientQuery)
      .select("notificationId readAt")
      .lean();

    const notificationIds = recipients.map((r) => r.notificationId);
    const readMap = new Map(
      recipients.map((r) => [r.notificationId, r.readAt])
    );

    if (notificationIds.length === 0) {
      return { notifications: [], total: 0 };
    }

    // Build notification query
    const notificationQuery = {
      _id: { $in: notificationIds },
    };

    if (type) {
      notificationQuery.type = Array.isArray(type) ? { $in: type } : type;
    }

    if (priority) {
      notificationQuery.priority = Array.isArray(priority)
        ? { $in: priority }
        : priority;
    }

    if (dateFrom || dateTo) {
      notificationQuery.createdAt = {};
      if (dateFrom) {
        notificationQuery.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        notificationQuery.createdAt.$lte = new Date(dateTo);
      }
    }

    if (search) {
      notificationQuery.$or = [
        { title: { $regex: search, $options: "i" } },
        { body: { $regex: search, $options: "i" } },
      ];
    }

    const total = await Notification.countDocuments(notificationQuery);

    const notifications = await Notification.find(notificationQuery)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset)
      .lean();

    // Attach read status to notifications
    const notificationsWithReadStatus = notifications.map((notif) => ({
      ...notif,
      isRead: !!readMap.get(notif._id),
      readAt: readMap.get(notif._id) || null,
    }));

    return {
      notifications: notificationsWithReadStatus,
      total,
    };
  }

  /**
   * Get unread count for a user
   * @param {String} userId - User ID
   * @returns {Promise<Number>} Unread count
   */
  static async getUnreadCount(userId) {
    const count = await NotificationRecipient.countDocuments({
      userId,
      readAt: null,
      archivedAt: null,
    });
    return count;
  }

  /**
   * Get recent notifications for SSE
   * @param {String} userId - User ID
   * @param {Number} limit - Number of recent notifications
   * @returns {Promise<Array>} Recent notifications
   */
  static async getRecentNotifications(userId, limit = 5) {
    const recipients = await NotificationRecipient.find({
      userId,
      archivedAt: null,
    })
      .populate("notificationId")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return recipients
      .filter((r) => r.notificationId)
      .map((r) => ({
        id: r.notificationId._id.toString(),
        type: r.notificationId.type,
        title: r.notificationId.title,
        body: r.notificationId.body,
        priority: r.notificationId.priority,
        metadata: r.notificationId.metadata || {},
        timestamp: r.notificationId.createdAt,
        isRead: !!r.readAt,
      }));
  }

  /**
   * Mark notifications as read
   * @param {String} userId - User ID
   * @param {Array} notificationIds - Array of notification IDs
   * @returns {Promise<Boolean>} Success status
   */
  static async markAsRead(userId, notificationIds) {
    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      throw new AppError("Notification IDs array is required", 400);
    }

    const result = await NotificationRecipient.updateMany(
      {
        userId,
        notificationId: { $in: notificationIds },
        readAt: null,
      },
      {
        readAt: new Date(),
      }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Mark all notifications as read for a user
   * @param {String} userId - User ID
   * @returns {Promise<Boolean>} Success status
   */
  static async markAllAsRead(userId) {
    const result = await NotificationRecipient.updateMany(
      {
        userId,
        readAt: null,
        archivedAt: null,
      },
      {
        readAt: new Date(),
      }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Archive notifications
   * @param {String} userId - User ID
   * @param {Array} notificationIds - Array of notification IDs
   * @returns {Promise<Boolean>} Success status
   */
  static async archive(userId, notificationIds) {
    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      throw new AppError("Notification IDs array is required", 400);
    }

    const result = await NotificationRecipient.updateMany(
      {
        userId,
        notificationId: { $in: notificationIds },
        archivedAt: null,
      },
      {
        archivedAt: new Date(),
      }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Get notifications sent by admin (where actorId = adminId)
   * @param {String} adminId - Admin user ID
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Notifications and total count
   */
  static async getAdminNotifications(adminId, filters = {}) {
    const {
      isRead,
      type,
      priority,
      limit = 50,
      offset = 0,
      search,
      dateFrom,
      dateTo,
    } = filters;

    // Build notification query - only notifications sent by this admin
    const notificationQuery = {
      actorId: adminId,
    };

    if (type) {
      notificationQuery.type = Array.isArray(type) ? { $in: type } : type;
    }

    if (priority) {
      notificationQuery.priority = Array.isArray(priority)
        ? { $in: priority }
        : priority;
    }

    if (dateFrom || dateTo) {
      notificationQuery.createdAt = {};
      if (dateFrom) {
        notificationQuery.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        notificationQuery.createdAt.$lte = new Date(dateTo);
      }
    }

    if (search) {
      notificationQuery.$or = [
        { title: { $regex: search, $options: "i" } },
        { body: { $regex: search, $options: "i" } },
      ];
    }

    const total = await Notification.countDocuments(notificationQuery);

    const notifications = await Notification.find(notificationQuery)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(offset)
      .lean();

    // Get recipient counts for each notification
    const notificationIds = notifications.map((n) => n._id);
    const recipientCounts = await NotificationRecipient.aggregate([
      {
        $match: {
          notificationId: { $in: notificationIds },
        },
      },
      {
        $group: {
          _id: "$notificationId",
          recipientCount: { $sum: 1 },
        },
      },
    ]);

    const recipientCountMap = new Map(
      recipientCounts.map((r) => [r._id.toString(), r.recipientCount])
    );

    // Attach recipient count to notifications
    const notificationsWithCounts = notifications.map((notif) => ({
      ...notif,
      recipientCount: recipientCountMap.get(notif._id.toString()) || 0,
      isRead: false, // Admin notifications don't have read status for admin
    }));

    return {
      notifications: notificationsWithCounts,
      total,
    };
  }

  /**
   * Get notification statistics for a user
   * @param {String} userId - User ID
   * @returns {Promise<Object>} Statistics
   */
  static async getStats(userId) {
    const recipients = await NotificationRecipient.find({
      userId,
      archivedAt: null,
    })
      .populate("notificationId")
      .lean();

    const notifications = recipients
      .filter((r) => r.notificationId)
      .map((r) => r.notificationId);

    const total = notifications.length;
    const unread = recipients.filter((r) => !r.readAt).length;

    const byType = {};
    const byPriority = {};

    notifications.forEach((notif) => {
      byType[notif.type] = (byType[notif.type] || 0) + 1;
      byPriority[notif.priority] = (byPriority[notif.priority] || 0) + 1;
    });

    return {
      total,
      unread,
      byType,
      byPriority,
    };
  }
}

module.exports = NotificationService;
