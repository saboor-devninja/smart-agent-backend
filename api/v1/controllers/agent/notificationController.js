const NotificationService = require("../../services/notificationService");
const tryCatchAsync = require("../../../../utils/tryCatchAsync");
const apiResponse = require("../../../../utils/apiResponse");
const { success } = require("../../../../utils/statusCode").statusCode;
const { verifyToken } = require("../../../../utils/jwt");

/**
 * GET /api/v1/notifications
 * Get notifications for the current user
 */
exports.getNotifications = tryCatchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const filters = {
    isRead: req.query.isRead !== undefined ? req.query.isRead === "true" : undefined,
    type: req.query.type ? (Array.isArray(req.query.type) ? req.query.type : [req.query.type]) : undefined,
    priority: req.query.priority
      ? Array.isArray(req.query.priority)
        ? req.query.priority
        : [req.query.priority]
      : undefined,
    limit: req.query.limit ? parseInt(req.query.limit) : 50,
    offset: req.query.offset ? parseInt(req.query.offset) : 0,
    search: req.query.search || undefined,
    dateFrom: req.query.dateFrom || undefined,
    dateTo: req.query.dateTo || undefined,
  };

  const result = await NotificationService.getNotifications(userId, filters);

  apiResponse.successResponse(
    res,
    {
      notifications: result.notifications,
      total: result.total,
      unreadCount: await NotificationService.getUnreadCount(userId),
    },
    "Notifications retrieved successfully",
    success
  );
});

/**
 * GET /api/v1/notifications/unread-count
 * Get unread notification count
 */
exports.getUnreadCount = tryCatchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const count = await NotificationService.getUnreadCount(userId);

  apiResponse.successResponse(
    res,
    { unreadCount: count },
    "Unread count retrieved successfully",
    success
  );
});

/**
 * GET /api/v1/notifications/stats
 * Get notification statistics
 */
exports.getStats = tryCatchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const stats = await NotificationService.getStats(userId);

  apiResponse.successResponse(
    res,
    { stats },
    "Notification statistics retrieved successfully",
    success
  );
});

/**
 * PATCH /api/v1/notifications/read
 * Mark notifications as read
 */
exports.markAsRead = tryCatchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { notificationIds } = req.body;

  if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
    return apiResponse.errorResponse(
      res,
      "Notification IDs array is required",
      400
    );
  }

  const result = await NotificationService.markAsRead(userId, notificationIds);
  const unreadCount = await NotificationService.getUnreadCount(userId);

  apiResponse.successResponse(
    res,
    { success: result, unreadCount },
    "Notifications marked as read",
    success
  );
});

/**
 * PATCH /api/v1/notifications/read-all
 * Mark all notifications as read
 */
exports.markAllAsRead = tryCatchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const result = await NotificationService.markAllAsRead(userId);
  const unreadCount = await NotificationService.getUnreadCount(userId);

  apiResponse.successResponse(
    res,
    { success: result, unreadCount },
    "All notifications marked as read",
    success
  );
});

/**
 * PATCH /api/v1/notifications/archive
 * Archive notifications
 */
exports.archive = tryCatchAsync(async (req, res, next) => {
  const userId = req.user._id;
  const { notificationIds } = req.body;

  if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
    return apiResponse.errorResponse(
      res,
      "Notification IDs array is required",
      400
    );
  }

  const result = await NotificationService.archive(userId, notificationIds);
  const unreadCount = await NotificationService.getUnreadCount(userId);

  apiResponse.successResponse(
    res,
    { success: result, unreadCount },
    "Notifications archived successfully",
    success
  );
});

/**
 * GET /api/v1/notifications/sse
 * Server-Sent Events endpoint for real-time notifications
 * Note: This endpoint uses token in query string instead of header
 */
exports.sseHandler = tryCatchAsync(async (req, res, next) => {
  // Get token from query string or header
  const token = req.query.token || req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Verify token (verifyToken is synchronous, no need for await)
  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }

  // Token is signed with { userId, role }, so use decoded.userId
  const userId = decoded.userId || decoded._id || decoded.id;

  if (!userId) {
    return res.status(401).json({ error: "Invalid token: missing userId" });
  }

  // Set SSE headers (must be set before any writes)
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable Nginx buffering
  
  // CORS headers for SSE
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  
  // Flush headers immediately
  res.flushHeaders();

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: "connected", timestamp: new Date() })}\n\n`);

  // Track last known state
  let lastUnreadCount = 0;
  let lastNotificationIds = new Set();

  // Initial check
  try {
    const unreadCount = await NotificationService.getUnreadCount(userId);
    const recentNotifications = await NotificationService.getRecentNotifications(userId, 5);
    lastUnreadCount = unreadCount;
    lastNotificationIds = new Set(recentNotifications.map((n) => n.id));

    res.write(
      `data: ${JSON.stringify({
        type: "update",
        unreadCount,
        recentNotifications,
        timestamp: new Date(),
      })}\n\n`
    );
  } catch (error) {
    console.error("SSE initial check error:", error);
  }

  // Set up interval to check for new notifications (every 5 seconds)
  const interval = setInterval(async () => {
    try {
      // Get unread count
      let unreadCount = 0;
      try {
        unreadCount = await NotificationService.getUnreadCount(userId);
      } catch (error) {
        console.error("Error fetching unread count:", error);
        unreadCount = 0;
      }

      // Get recent notifications
      let recentNotifications = [];
      try {
        recentNotifications = await NotificationService.getRecentNotifications(userId, 5);
      } catch (error) {
        console.error("Error fetching recent notifications:", error);
        recentNotifications = [];
      }

      // Check for new notifications
      const currentNotificationIds = new Set(recentNotifications.map((n) => n.id));
      const hasNewNotifications =
        unreadCount > lastUnreadCount ||
        recentNotifications.some((n) => !lastNotificationIds.has(n.id));

      // Send update
      const data = {
        type: "update",
        unreadCount,
        recentNotifications,
        hasNewNotifications,
        timestamp: new Date(),
      };

      res.write(`data: ${JSON.stringify(data)}\n\n`);

      // Update tracking
      lastUnreadCount = unreadCount;
      lastNotificationIds = currentNotificationIds;
    } catch (error) {
      console.error("SSE error:", error);
    }
  }, 5000); // Check every 5 seconds

  // Clean up on connection close
  req.on("close", () => {
    clearInterval(interval);
    res.end();
  });
});
