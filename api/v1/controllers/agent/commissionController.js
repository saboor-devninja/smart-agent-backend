const CommissionService = require("../../services/commissionService");
const tryCatchAsync = require("../../../../utils/tryCatchAsync");
const apiResponse = require("../../../../utils/apiResponse");
const AppError = require("../../../../utils/appError");
const { success, badRequest } = require("../../../../utils/statusCode").statusCode;

exports.getAgentCommissions = tryCatchAsync(async (req, res, next) => {
  const { status, leaseId, startDate, endDate } = req.query;

  const filters = {};
  if (status) filters.status = status;
  if (leaseId) filters.leaseId = leaseId;
  if (startDate) filters.startDate = startDate;
  if (endDate) filters.endDate = endDate;

  let commissions;

  // Platform admin: see all commissions across the platform
  if (req.user.role === "PLATFORM_ADMIN") {
    commissions = await CommissionService.getAllCommissions(filters);
  } else {
    // Agents and agency admins: scoped to their agent/agency
    commissions = await CommissionService.getAgentCommissions(
      req.user._id,
      req.user.agencyId || null,
      filters
    );
  }

  return apiResponse.successResponse(
    res,
    { commissions },
    "Agent commissions retrieved successfully",
    success
  );
});

exports.getLandlordPayments = tryCatchAsync(async (req, res, next) => {
  const { landlordId } = req.params;
  const { status, leaseId, startDate, endDate } = req.query;

  if (!landlordId) {
    return next(new AppError("landlordId is required", badRequest));
  }

  const filters = {};
  if (status) filters.status = status;
  if (leaseId) filters.leaseId = leaseId;
  if (startDate) filters.startDate = startDate;
  if (endDate) filters.endDate = endDate;

  const payments = await CommissionService.getLandlordPayments(landlordId, filters);

  return apiResponse.successResponse(
    res,
    { payments },
    "Landlord payments retrieved successfully",
    success
  );
});

exports.getRelatedByPayment = tryCatchAsync(async (req, res, next) => {
  const { paymentRecordId } = req.params;

  if (!paymentRecordId) {
    return next(new AppError("paymentRecordId is required", badRequest));
  }

  const result = await CommissionService.getRelatedRecords(paymentRecordId);

  return apiResponse.successResponse(
    res,
    result,
    "Related records retrieved successfully",
    success
  );
});

exports.getRelatedByCommission = tryCatchAsync(async (req, res, next) => {
  const { commissionRecordId } = req.params;

  if (!commissionRecordId) {
    return next(new AppError("commissionRecordId is required", badRequest));
  }

  const result = await CommissionService.getRelatedRecordsByCommission(commissionRecordId);

  return apiResponse.successResponse(
    res,
    result,
    "Related records retrieved successfully",
    success
  );
});

exports.getRelatedByLandlordPayment = tryCatchAsync(async (req, res, next) => {
  const { landlordPaymentId } = req.params;

  if (!landlordPaymentId) {
    return next(new AppError("landlordPaymentId is required", badRequest));
  }

  const result = await CommissionService.getRelatedRecordsByLandlordPayment(landlordPaymentId);

  return apiResponse.successResponse(
    res,
    result,
    "Related records retrieved successfully",
    success
  );
});

exports.updateLandlordPayment = tryCatchAsync(async (req, res, next) => {
  const { landlordPaymentId } = req.params;
  const { status, paymentMethod, paymentReference, paidAt, notes } = req.body;

  if (!landlordPaymentId) {
    return next(new AppError("landlordPaymentId is required", badRequest));
  }

  const updatedPayment = await CommissionService.updateLandlordPayment(
    landlordPaymentId,
    {
      status,
      paymentMethod,
      paymentReference,
      paidAt,
      notes,
    },
    req.user._id
  );

  return apiResponse.successResponse(
    res,
    { payment: updatedPayment },
    "Landlord payment updated successfully",
    success
  );
});

exports.markPlatformFeeAsPaid = tryCatchAsync(async (req, res, next) => {
  // Platform admin can mark any; agents can mark their own platform fees as paid
  const commissionRecordId = req.params.id;
  const { paidDate, paymentMethod, paymentReference, notes } = req.body;

  if (!commissionRecordId) {
    return next(new AppError("commissionRecordId is required", badRequest));
  }

  const updatedCommission = await CommissionService.markPlatformFeeAsPaid(
    commissionRecordId,
    {
      paidDate: paidDate ? new Date(paidDate) : new Date(),
      paymentMethod,
      paymentReference,
      notes,
    },
    req.user._id,
    req.user.role === "PLATFORM_ADMIN",
    req.user.agencyId || null
  );

  return apiResponse.successResponse(
    res,
    { commission: updatedCommission },
    "Platform fee marked as paid successfully",
    success
  );
});

exports.markPlatformFeeAsPaidByPaymentRecord = tryCatchAsync(async (req, res, next) => {
  // Platform admin can mark any; agents can mark their own payment records' platform fees as paid
  const leasePaymentRecordId = req.params.leasePaymentRecordId;
  const { paidDate, paymentMethod, paymentReference, notes } = req.body;

  if (!leasePaymentRecordId) {
    return next(new AppError("leasePaymentRecordId is required", badRequest));
  }

  const updatedRecord = await CommissionService.markPlatformFeeAsPaidByPaymentRecord(
    leasePaymentRecordId,
    {
      paidDate: paidDate ? new Date(paidDate) : new Date(),
      paymentMethod,
      paymentReference,
      notes,
    },
    req.user._id,
    req.user.role === "PLATFORM_ADMIN",
    req.user.agencyId || null
  );

  return apiResponse.successResponse(
    res,
    { record: updatedRecord },
    "Platform fee marked as paid successfully",
    success
  );
});
