const LeasePaymentService = require("../../services/leasePaymentService");
const tryCatchAsync = require("../../../../utils/tryCatchAsync");
const apiResponse = require("../../../../utils/apiResponse");
const AppError = require("../../../../utils/appError");
const { success, created, badRequest } = require("../../../../utils/statusCode").statusCode;

exports.getByLease = tryCatchAsync(async (req, res, next) => {
  const leaseId = req.query.leaseId;

  if (!leaseId) {
    return next(new AppError("leaseId is required", badRequest));
  }

  // Platform admin can access all lease payments without filtering by agentId/agencyId
  const agentId = req.user.role === 'PLATFORM_ADMIN' ? null : req.user._id;
  const agencyId = req.user.role === 'PLATFORM_ADMIN' ? null : (req.user.agencyId || null);

  const result = await LeasePaymentService.getByLease(
    leaseId,
    agentId,
    agencyId
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

  // Platform admin can access all lease payments without filtering by agentId/agencyId
  const agentId = req.user.role === 'PLATFORM_ADMIN' ? null : req.user._id;
  const agencyId = req.user.role === 'PLATFORM_ADMIN' ? null : (req.user.agencyId || null);

  const record = await LeasePaymentService.create(
    leaseId,
    req.body,
    agentId,
    agencyId
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

  // Platform admin can access all lease payments without filtering by agentId/agencyId
  const agentId = req.user.role === 'PLATFORM_ADMIN' ? null : req.user._id;
  const agencyId = req.user.role === 'PLATFORM_ADMIN' ? null : (req.user.agencyId || null);

  const record = await LeasePaymentService.update(
    id,
    req.body,
    agentId,
    agencyId
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

  // Platform admin can access all lease payments without filtering by agentId/agencyId
  const agentId = req.user.role === 'PLATFORM_ADMIN' ? null : req.user._id;
  const agencyId = req.user.role === 'PLATFORM_ADMIN' ? null : (req.user.agencyId || null);

  const result = await LeasePaymentService.getByIdWithRelated(
    id,
    agentId,
    agencyId
  );

  return apiResponse.successResponse(
    res,
    result,
    "Payment record with related records retrieved successfully",
    success
  );
});

exports.getAll = tryCatchAsync(async (req, res, next) => {
  const {
    propertyId,
    tenantId,
    landlordId,
    status,
    type,
    dateFrom,
    dateTo,
    month,
    year,
    limit,
    offset,
  } = req.query;

  const filters = {
    propertyId: propertyId || null,
    tenantId: tenantId || null,
    landlordId: landlordId || null,
    status: status || "all",
    type: type || "all",
    dateFrom: dateFrom || null,
    dateTo: dateTo || null,
    month: month ? parseInt(month) : null,
    year: year ? parseInt(year) : null,
    limit: limit ? parseInt(limit) : 1000,
    offset: offset ? parseInt(offset) : 0,
  };

  // Platform admin can access all lease payments without filtering by agentId/agencyId
  const agentId = req.user.role === 'PLATFORM_ADMIN' ? null : req.user._id;
  const agencyId = req.user.role === 'PLATFORM_ADMIN' ? null : (req.user.agencyId || null);

  const result = await LeasePaymentService.getAllPayments(
    agentId,
    agencyId,
    filters
  );

  return apiResponse.successResponse(
    res,
    result,
    "Rent payments retrieved successfully",
    success
  );
});

exports.delete = tryCatchAsync(async (req, res, next) => {
  const { id } = req.params;

  if (!id) {
    return next(new AppError("Payment record id is required", badRequest));
  }

  // Platform admin can access all lease payments without filtering by agentId/agencyId
  const agentId = req.user.role === 'PLATFORM_ADMIN' ? null : req.user._id;
  const agencyId = req.user.role === 'PLATFORM_ADMIN' ? null : (req.user.agencyId || null);

  const record = await LeasePaymentService.delete(
    id,
    agentId,
    agencyId
  );

  return apiResponse.successResponse(
    res,
    { record },
    "Payment record and related records deleted successfully",
    success
  );
});
