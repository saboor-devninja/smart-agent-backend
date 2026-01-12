const LeaseService = require("../../services/leaseService");
const LeaseDTO = require("../../../../dtos/add/LeaseDTO");
const tryCatchAsync = require("../../../../utils/tryCatchAsync");
const apiResponse = require("../../../../utils/apiResponse");
const AppError = require("../../../../utils/appError");
const { created, success, badRequest } = require("../../../../utils/statusCode").statusCode;
const { parseNestedFormData } = require("../../../../utils/parseFormData");

exports.createLease = tryCatchAsync(async (req, res, next) => {
  const parsedBody = parseNestedFormData(req.body);
  const validation = LeaseDTO.validate(parsedBody);

  if (!validation.isValid) {
    return next(new AppError(validation.errors.join(", "), badRequest));
  }

  const files = req.files || {};
  const lease = await LeaseService.createLease(
    { ...validation.data, inspectionNotes: parsedBody.inspectionNotes },
    req.user._id,
    req.user.agencyId || null,
    files
  );

  return apiResponse.successResponse(res, { lease }, "Lease created successfully", created);
});

exports.getLeases = tryCatchAsync(async (req, res, next) => {
  const filters = {
    agentId: req.user._id,
    agencyId: req.user.agencyId || null,
    propertyId: req.query.propertyId,
    tenantId: req.query.tenantId,
    landlordId: req.query.landlordId,
    status: req.query.status,
    search: req.query.search,
    limit: req.query.limit,
    skip: req.query.skip,
  };

  const result = await LeaseService.getLeases(filters.agentId, filters.agencyId, filters);

  return apiResponse.successResponse(
    res,
    {
      leases: result.leases,
      totalCount: result.totalCount,
      count: result.count,
    },
    "Leases retrieved successfully",
    success
  );
});

exports.getLeaseById = tryCatchAsync(async (req, res, next) => {
  const lease = await LeaseService.getLeaseById(
    req.params.id,
    req.user._id,
    req.user.agencyId || null
  );

  return apiResponse.successResponse(res, { lease }, "Lease retrieved successfully", success);
});

exports.updateLease = tryCatchAsync(async (req, res, next) => {
  const parsedBody = parseNestedFormData(req.body);
  const validation = LeaseDTO.validateForUpdate(parsedBody);

  if (!validation.isValid) {
    return next(new AppError(validation.errors.join(", "), badRequest));
  }

  const lease = await LeaseService.updateLease(
    req.params.id,
    validation.data,
    req.user._id,
    req.user.agencyId || null
  );

  return apiResponse.successResponse(res, { lease }, "Lease updated successfully", success);
});

exports.deleteLease = tryCatchAsync(async (req, res, next) => {
  await LeaseService.deleteLease(
    req.params.id,
    req.user._id,
    req.user.agencyId || null
  );

  return apiResponse.successResponse(res, null, "Lease deleted successfully", success);
});

exports.moveToPendingStart = tryCatchAsync(async (req, res, next) => {
  const lease = await LeaseService.moveToPendingStart(
    req.params.id,
    req.user._id,
    req.user.agencyId || null
  );

  return apiResponse.successResponse(res, { lease }, "Lease moved to pending start successfully", success);
});

exports.activateLease = tryCatchAsync(async (req, res, next) => {
  const parsedBody = parseNestedFormData(req.body);
  const actualStartDate = parsedBody.actualStartDate || null;

  const lease = await LeaseService.activateLease(
    req.params.id,
    req.user._id,
    req.user.agencyId || null,
    actualStartDate
  );

  return apiResponse.successResponse(res, { lease }, "Lease activated successfully", success);
});

exports.terminateLease = tryCatchAsync(async (req, res, next) => {
  const parsedBody = parseNestedFormData(req.body);
  const terminationDate = parsedBody.terminationDate || null;
  const reason = parsedBody.reason || null;

  const lease = await LeaseService.terminateLease(
    req.params.id,
    req.user._id,
    req.user.agencyId || null,
    terminationDate,
    reason
  );

  return apiResponse.successResponse(res, { lease }, "Lease terminated successfully", success);
});

exports.cancelLease = tryCatchAsync(async (req, res, next) => {
  const lease = await LeaseService.cancelLease(
    req.params.id,
    req.user._id,
    req.user.agencyId || null
  );

  return apiResponse.successResponse(res, { lease }, "Lease cancelled successfully", success);
});

