const TenantService = require("../../services/tenantService");
const tryCatchAsync = require("../../../../utils/tryCatchAsync");
const apiResponse = require("../../../../utils/apiResponse");
const AppError = require("../../../../utils/appError");
const { created, success, badRequest } = require("../../../../utils/statusCode").statusCode;
const TenantDTO = require("../../../../dtos/add/TenantDTO");
const TenantReturnDTO = require("../../../../dtos/return/TenantDTO");
const { parseNestedFormData } = require("../../../../utils/parseFormData");
const { formatDateForStorage } = require("../../../../utils/dateUtils");

exports.createTenant = tryCatchAsync(async (req, res, next) => {
  const parsedBody = parseNestedFormData(req.body);

  const validation = TenantDTO.validate(parsedBody);

  if (!validation.isValid) {
    return next(new AppError(validation.errors.join(", "), badRequest));
  }

  const profilePictureFile = req.file || null;

  if (profilePictureFile) {
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!validTypes.includes(profilePictureFile.mimetype)) {
      return next(new AppError("Only JPEG, PNG, and WebP images are allowed for profile pictures", badRequest));
    }
  }

  const tenant = await TenantService.createTenant(
    validation.data,
    req.user._id,
    req.user.agencyId || null,
    profilePictureFile
  );

  return apiResponse.successResponse(res, { tenant }, "Tenant created successfully", created);
});

exports.getTenants = tryCatchAsync(async (req, res, next) => {
  const filters = {
    agentId: req.query.agentId || (req.user.role !== 'PLATFORM_ADMIN' ? req.user._id : undefined),
    agencyId: req.query.agencyId || (req.user.role !== 'PLATFORM_ADMIN' ? (req.user.agencyId || null) : undefined),
    city: req.query.city,
    country: req.query.country,
    search: req.query.search,
    limit: req.query.limit,
    skip: req.query.skip,
  };

  // For platform admin, pass null to get all tenants
  const agentId = req.user.role === 'PLATFORM_ADMIN' ? null : filters.agentId;
  const agencyId = req.user.role === 'PLATFORM_ADMIN' ? null : filters.agencyId;

  const result = await TenantService.getTenants(agentId, agencyId, filters);

  return apiResponse.successResponse(
    res,
    {
      tenants: result.tenants,
      totalCount: result.totalCount,
      count: result.count,
    },
    "Tenants retrieved successfully",
    success
  );
});

exports.getTenant = tryCatchAsync(async (req, res, next) => {
  const tenant = await TenantService.getTenantById(
    req.params.id,
    req.user._id,
    req.user.agencyId || null
  );

  return apiResponse.successResponse(res, { tenant }, "Tenant retrieved successfully", success);
});

exports.updateTenant = tryCatchAsync(async (req, res, next) => {
  const parsedBody = parseNestedFormData(req.body);

  const validation = TenantDTO.validate(parsedBody);

  if (!validation.isValid) {
    return next(new AppError(validation.errors.join(", "), badRequest));
  }

  const profilePictureFile = req.file || null;

  if (profilePictureFile) {
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!validTypes.includes(profilePictureFile.mimetype)) {
      return next(new AppError("Only JPEG, PNG, and WebP images are allowed for profile pictures", badRequest));
    }
  }

  const tenant = await TenantService.updateTenant(
    req.params.id,
    validation.data,
    req.user._id,
    req.user.agencyId || null,
    profilePictureFile
  );

  return apiResponse.successResponse(res, { tenant }, "Tenant updated successfully", success);
});

exports.deleteTenant = tryCatchAsync(async (req, res, next) => {
  await TenantService.deleteTenant(
    req.params.id,
    req.user._id,
    req.user.agencyId || null
  );

  return apiResponse.successResponse(res, null, "Tenant deleted successfully", success);
});

exports.getTenantsForSelect = tryCatchAsync(async (req, res, next) => {
  const result = await TenantService.getTenantsForSelect(
    req.user._id,
    req.user.agencyId || null
  );

  return apiResponse.successResponse(res, result, "Tenants retrieved successfully", success);
});

