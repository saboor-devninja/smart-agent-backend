const NotificationService = require("../../services/notificationService");
const tryCatchAsync = require("../../../../utils/tryCatchAsync");
const apiResponse = require("../../../../utils/apiResponse");
const { success } = require("../../../../utils/statusCode").statusCode;
const AppError = require("../../../../utils/appError");
const { badRequest } = require("../../../../utils/statusCode").statusCode;
const User = require("../../../../models/User");

/**
 * GET /api/v1/admin/notifications
 * Get notifications sent by admin (only for PLATFORM_ADMIN)
 */
exports.getAdminNotifications = tryCatchAsync(async (req, res, next) => {
  if (req.user.role !== 'PLATFORM_ADMIN') {
    return next(new AppError('Only platform admins can access this endpoint', 403));
  }

  const adminId = req.user._id;
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

  const result = await NotificationService.getAdminNotifications(adminId, filters);

  apiResponse.successResponse(
    res,
    {
      notifications: result.notifications,
      total: result.total,
    },
    "Admin notifications retrieved successfully",
    success
  );
});

/**
 * GET /api/v1/admin/notifications/recipients
 * Get all users/agents for admin to send notifications (only for PLATFORM_ADMIN)
 */
exports.getRecipients = tryCatchAsync(async (req, res, next) => {
  if (req.user.role !== 'PLATFORM_ADMIN') {
    return next(new AppError('Only platform admins can access this endpoint', 403));
  }

  const Agency = require("../../../../models/Agency");

  const users = await User.find({
    role: { $in: ['AGENT', 'AGENCY_ADMIN'] },
    isActive: true,
  })
    .select('_id firstName lastName email role agencyId isIndependent')
    .populate('agencyId', 'name')
    .sort({ firstName: 1, lastName: 1 })
    .lean();

  // Get unique agencies from users
  const agencyIds = [...new Set(users.filter(u => u.agencyId).map(u => u.agencyId._id || u.agencyId))];
  
  const agencies = await Agency.find({
    _id: { $in: agencyIds },
    status: 'ACTIVE',
  })
    .select('_id name')
    .lean();

  apiResponse.successResponse(
    res,
    {
      users,
      agencies,
    },
    "Recipients retrieved successfully",
    success
  );
});

/**
 * POST /api/v1/admin/notifications/send
 * Send notification from admin to selected recipients (only for PLATFORM_ADMIN)
 */
exports.sendNotification = tryCatchAsync(async (req, res, next) => {
  if (req.user.role !== 'PLATFORM_ADMIN') {
    return next(new AppError('Only platform admins can send notifications', 403));
  }

  const { title, body, priority = 'NORMAL', recipientType, recipientIds } = req.body;

  if (!title || !body) {
    return next(new AppError('Title and body are required', badRequest));
  }

  if (!recipientType || !['all', 'agent', 'agency'].includes(recipientType)) {
    return next(new AppError('Invalid recipient type. Must be: all, agent, or agency', badRequest));
  }

  let recipientUserIds = [];

  if (recipientType === 'all') {
    // Send to all active agents and agency admins
    const allUsers = await User.find({
      role: { $in: ['AGENT', 'AGENCY_ADMIN'] },
      isActive: true,
    })
      .select('_id')
      .lean();
    recipientUserIds = allUsers.map((u) => u._id);
  } else if (recipientType === 'agency') {
    // Send to all users in selected agencies
    if (!recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
      return next(new AppError('Please select at least one agency', badRequest));
    }

    const agencyUsers = await User.find({
      agencyId: { $in: recipientIds },
      isActive: true,
    })
      .select('_id')
      .lean();
    recipientUserIds = agencyUsers.map((u) => u._id);
  } else {
    // Send to selected agents
    if (!recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
      return next(new AppError('Please select at least one recipient', badRequest));
    }
    recipientUserIds = recipientIds;
  }

  if (recipientUserIds.length === 0) {
    return next(new AppError('No recipients found', badRequest));
  }

  // Create notification
  const notificationData = {
    type: 'ADMIN_NOTIFICATION',
    title,
    body,
    priority,
    actorId: req.user._id,
  };

  const recipients = recipientUserIds.map((userId) => ({
    userId,
    channels: ['IN_APP'],
  }));

  const notification = await NotificationService.createNotification(notificationData, recipients);

  apiResponse.successResponse(
    res,
    {
      notification,
      recipientsCount: recipientUserIds.length,
    },
    `Notification sent to ${recipientUserIds.length} recipient(s)`,
    success
  );
});
