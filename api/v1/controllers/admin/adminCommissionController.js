const CommissionService = require("../../services/commissionService");
const tryCatchAsync = require("../../../../utils/tryCatchAsync");
const apiResponse = require("../../../../utils/apiResponse");
const AppError = require("../../../../utils/appError");
const { success, badRequest } = require("../../../../utils/statusCode").statusCode;

/**
 * POST /api/v1/admin/commissions/backfill
 * Create commission records for paid rent payments that don't have one (PLATFORM_ADMIN only)
 */
exports.backfillCommissions = tryCatchAsync(async (req, res, next) => {
  if (req.user.role !== "PLATFORM_ADMIN") {
    return next(new AppError("Only platform admins can access this endpoint", 403));
  }

  const result = await CommissionService.backfillMissingCommissions();

  return apiResponse.successResponse(
    res,
    result,
    `Backfill complete: ${result.created} created, ${result.skipped} already had commissions${result.errors.length ? `, ${result.errors.length} errors` : ""}`,
    success
  );
});

/**
 * GET /api/v1/admin/commissions
 * Get all records with platform fee (CommissionRecords + LeasePaymentRecords without commission)
 * so admin can mark platform fee on all - paid or not (PLATFORM_ADMIN only)
 */
exports.getAllCommissions = tryCatchAsync(async (req, res, next) => {
  if (req.user.role !== "PLATFORM_ADMIN") {
    return next(new AppError("Only platform admins can access this endpoint", 403));
  }

  const { status, leaseId, startDate, endDate } = req.query;

  const filters = {};
  if (status && status !== "all") filters.status = status;
  if (leaseId) filters.leaseId = leaseId;
  if (startDate) filters.startDate = startDate;
  if (endDate) filters.endDate = endDate;

  const commissions = await CommissionService.getAllPlatformFeeRecords(filters);

  return apiResponse.successResponse(
    res,
    { commissions },
    "Platform fee records retrieved successfully",
    success
  );
});
