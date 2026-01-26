const tryCatchAsync = require("../../../../utils/tryCatchAsync");
const apiResponse = require("../../../../utils/apiResponse");
const { success } = require("../../../../utils/statusCode").statusCode;
const AppError = require("../../../../utils/appError");
const AdminDashboardService = require("../../services/adminDashboardService");

/**
 * GET /api/v1/admin/dashboard/stats
 * Get admin dashboard statistics (only for PLATFORM_ADMIN)
 */
exports.getDashboardStats = tryCatchAsync(async (req, res, next) => {
  if (req.user.role !== 'PLATFORM_ADMIN') {
    return next(new AppError('Only platform admins can access this endpoint', 403));
  }

  const stats = await AdminDashboardService.getDashboardStats();

  return apiResponse.successResponse(
    res,
    { stats },
    "Dashboard statistics retrieved successfully",
    success
  );
});
