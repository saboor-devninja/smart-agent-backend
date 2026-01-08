const LeasePaymentService = require("../services/leasePaymentService");
const tryCatchAsync = require("../../../utils/tryCatchAsync");
const apiResponse = require("../../../utils/apiResponse");
const AppError = require("../../../utils/appError");
const { success, created, badRequest } = require("../../../utils/statusCode").statusCode;

exports.getByLease = tryCatchAsync(async (req, res, next) => {
  const leaseId = req.query.leaseId;

  if (!leaseId) {
    return next(new AppError("leaseId is required", badRequest));
  }

  const result = await LeasePaymentService.getByLease(
    leaseId,
    req.user._id,
    req.user.agencyId || null
  );

  return apiResponse.successResponse(
    res,
    {
      lease: result.lease,
      records: result.records,
    },
    "Lease payment records retrieved successfully",
    success
  );
});

exports.create = tryCatchAsync(async (req, res, next) => {
  const { leaseId } = req.body;

  if (!leaseId) {
    return next(new AppError("leaseId is required", badRequest));
  }

  if (!req.body.label || !req.body.amountDue) {
    return next(new AppError("label and amountDue are required", badRequest));
  }

  const record = await LeasePaymentService.create(
    leaseId,
    req.body,
    req.user._id,
    req.user.agencyId || null
  );

  return apiResponse.successResponse(
    res,
    { record },
    "Lease payment record created successfully",
    created
  );
});

exports.update = tryCatchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!id) {
    return next(new AppError("Payment record id is required", badRequest));
  }

  const record = await LeasePaymentService.update(
    id,
    req.body,
    req.user._id,
    req.user.agencyId || null
  );

  return apiResponse.successResponse(
    res,
    { record },
    "Lease payment record updated successfully",
    success
  );
});

exports.getByIdWithRelated = tryCatchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!id) {
    return next(new AppError("Payment record id is required", badRequest));
  }

  const result = await LeasePaymentService.getByIdWithRelated(
    id,
    req.user._id,
    req.user.agencyId || null
  );

  return apiResponse.successResponse(
    res,
    result,
    "Payment record with related records retrieved successfully",
    success
  );
});

