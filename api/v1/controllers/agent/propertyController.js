const PropertyService = require("../../services/propertyService");
const tryCatchAsync = require("../../../../utils/tryCatchAsync");
const apiResponse = require("../../../../utils/apiResponse");
const AppError = require("../../../../utils/appError");
const { created, success, badRequest } = require("../../../../utils/statusCode").statusCode;
const PropertyDTO = require("../../../../dtos/add/PropertyDTO");
const PropertyReturnDTO = require("../../../../dtos/return/PropertyDTO");
const { parseNestedFormData } = require("../../../../utils/parseFormData");

exports.createProperty = tryCatchAsync(async (req, res, next) => {
  const parsedBody = parseNestedFormData(req.body);
  const mediaFiles = req.files || [];
  
  const validation = PropertyDTO.validate(parsedBody);
  
  if (!validation.isValid) {
    return next(new AppError(validation.errors.join(", "), badRequest));
  }

  const property = await PropertyService.createProperty(
    validation.data,
    req.user._id,
    req.user.agencyId || null,
    parsedBody.utilities || [],
    mediaFiles
  );

  const propertyData = PropertyReturnDTO.setDTO(property);

  apiResponse.successResponse(
    res,
    { property: propertyData },
    "Property created successfully",
    created
  );
});

exports.getProperties = tryCatchAsync(async (req, res, next) => {
  const filters = {
    agentId: req.query.agentId,
    agencyId: req.user.agencyId || req.query.agencyId || null,
    landlordId: req.query.landlordId,
    isAvailable: req.query.isAvailable !== undefined ? req.query.isAvailable === 'true' : undefined,
    type: req.query.type,
    city: req.query.city,
    state: req.query.state,
    limit: req.query.limit ? parseInt(req.query.limit) : undefined,
    skip: req.query.skip ? parseInt(req.query.skip) : undefined,
  };

  if (req.user.role !== 'PLATFORM_ADMIN') {
    if (req.user.role === 'AGENCY_ADMIN') {
      filters.agencyId = req.user.agencyId;
    } else {
      filters.agentId = req.user._id;
    }
  }

  const properties = await PropertyService.getProperties(filters);
  const propertiesData = PropertyReturnDTO.setDTOList(properties);

  apiResponse.successResponse(
    res,
    { properties: propertiesData, count: propertiesData.length },
    "Properties retrieved successfully",
    success
  );
});

exports.getProperty = tryCatchAsync(async (req, res, next) => {
  // Resource ownership already checked in middleware.
  // Always use PropertyService.getPropertyById to ensure utilities, media,
  // landlord info, and lease flags are fully populated.
  const property = await PropertyService.getPropertyById(req.params.id);
  const propertyData = PropertyReturnDTO.setDTO(property);

  apiResponse.successResponse(
    res,
    { property: propertyData },
    "Property retrieved successfully",
    success
  );
});

exports.updateProperty = tryCatchAsync(async (req, res, next) => {
  const parsedBody = parseNestedFormData(req.body);
  const mediaFiles = req.files || [];
  
  const mediaToDelete = parsedBody.mediaToDelete || (Array.isArray(parsedBody['mediaToDelete[]']) ? parsedBody['mediaToDelete[]'] : []);
  
  const validation = PropertyDTO.validate(parsedBody);
  
  if (!validation.isValid) {
    return next(new AppError(validation.errors.join(", "), badRequest));
  }

  const updateData = {
    ...validation.data,
    mediaToDelete: mediaToDelete,
  };

  // Resource ownership already checked in middleware
  const property = await PropertyService.updateProperty(
    req.params.id,
    updateData,
    req.user._id,
    req.user.role,
    req.user.agencyId || null,
    parsedBody.utilities || [],
    mediaFiles
  );

  const propertyData = PropertyReturnDTO.setDTO(property);

  apiResponse.successResponse(
    res,
    { property: propertyData },
    "Property updated successfully",
    success
  );
});

exports.deleteProperty = tryCatchAsync(async (req, res, next) => {
  // Resource ownership already checked in middleware
  await PropertyService.deleteProperty(
    req.params.id,
    req.user._id,
    req.user.role,
    req.user.agencyId || null
  );

  apiResponse.successResponse(
    res,
    null,
    "Property deleted successfully",
    success
  );
});

