const NotificationPreferenceService = require("../services/notificationPreferenceService");
const tryCatchAsync = require("../../../utils/tryCatchAsync");
const apiResponse = require("../../../utils/apiResponse");
const AppError = require("../../../utils/appError");
const { success, badRequest } = require("../../../utils/statusCode").statusCode;

exports.getPreferences = tryCatchAsync(async (req, res, next) => {
  const preferences = await NotificationPreferenceService.getByUserId(req.user._id);

  return apiResponse.successResponse(
    res,
    { preferences },
    "Notification preferences retrieved successfully",
    success
  );
});

exports.updatePreferences = tryCatchAsync(async (req, res, next) => {
  const data = req.body;

  const preferences = await NotificationPreferenceService.update(req.user._id, data);

  return apiResponse.successResponse(
    res,
    { preferences },
    "Notification preferences updated successfully",
    success
  );
});

