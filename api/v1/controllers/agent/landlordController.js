const LandlordService = require("../../services/landlordService");
const tryCatchAsync = require("../../../../utils/tryCatchAsync");
const apiResponse = require("../../../../utils/apiResponse");
const AppError = require("../../../../utils/appError");
const { created, success, badRequest } = require("../../../../utils/statusCode").statusCode;
const LandlordDTO = require("../../../../dtos/add/LandlordDTO");
const LandlordReturnDTO = require("../../../../dtos/return/LandlordDTO");
const { parseNestedFormData } = require("../../../../utils/parseFormData");
const { formatDateForStorage } = require("../../../../utils/dateUtils");

exports.createLandlord = tryCatchAsync(async (req, res, next) => {
  const parsedBody = parseNestedFormData(req.body);
  
  if (parsedBody.isOrganization === 'true' || parsedBody.isOrganization === true) {
    parsedBody.isOrganization = true;
  } else {
    parsedBody.isOrganization = false;
  }
  
  const validation = LandlordDTO.validate(parsedBody);
  
  if (!validation.isValid) {
    return next(new AppError(validation.errors.join(", "), badRequest));
  }

  let bankAccountData = null;
  if (parsedBody.bankAccount) {
    const bankValidation = LandlordDTO.validateBankAccount(parsedBody.bankAccount);
    if (!bankValidation.isValid) {
      return next(new AppError(bankValidation.errors.join(", "), badRequest));
    }
    bankAccountData = bankValidation.data;
  }

  const profilePictureFile = req.file || null;

  if (profilePictureFile) {
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!validTypes.includes(profilePictureFile.mimetype)) {
      return next(new AppError("Only JPEG, PNG, and WebP images are allowed for profile pictures", badRequest));
    }
  }

  const landlord = await LandlordService.createLandlord(
    validation.data,
    req.user._id,
    req.user.agencyId || null,
    bankAccountData,
    profilePictureFile
  );

  const landlordData = LandlordReturnDTO.setDTO(landlord);

  apiResponse.successResponse(
    res,
    { landlord: landlordData },
    "Landlord created successfully",
    created
  );
});

exports.getLandlords = tryCatchAsync(async (req, res, next) => {
  const filters = {
    agentId: req.query.agentId,
    agencyId: req.user.agencyId || req.query.agencyId || null,
    isOrganization: req.query.isOrganization !== undefined ? req.query.isOrganization === 'true' : undefined,
    city: req.query.city,
    country: req.query.country,
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

  const result = await LandlordService.getLandlords(filters);
  const landlordsData = LandlordReturnDTO.setDTOList(result.landlords);

  apiResponse.successResponse(
    res,
    { landlords: landlordsData, totalCount: result.totalCount, count: landlordsData.length },
    "Landlords retrieved successfully",
    success
  );
});

exports.getLandlord = tryCatchAsync(async (req, res, next) => {
  // Resource ownership already checked in middleware
  // If req.resource exists, use it; otherwise fetch (shouldn't happen but safety check)
  const landlord = req.resource || await LandlordService.getLandlordDetailById(req.params.id);
  
  const landlordData = {
    ...LandlordReturnDTO.setDTO(landlord),
    properties: landlord.properties,
    statistics: landlord.statistics,
  };

  apiResponse.successResponse(
    res,
    { landlord: landlordData },
    "Landlord retrieved successfully",
    success
  );
});

exports.updateLandlord = tryCatchAsync(async (req, res, next) => {
  const parsedBody = parseNestedFormData(req.body);
  
  if (parsedBody.isOrganization === 'true' || parsedBody.isOrganization === true) {
    parsedBody.isOrganization = true;
  } else if (parsedBody.isOrganization !== undefined) {
    parsedBody.isOrganization = false;
  }
  
  const validation = LandlordDTO.validate(parsedBody);
  
  if (!validation.isValid) {
    return next(new AppError(validation.errors.join(", "), badRequest));
  }

  let bankAccountData = null;
  if (parsedBody.bankAccount) {
    const bankValidation = LandlordDTO.validateBankAccount(parsedBody.bankAccount);
    if (!bankValidation.isValid) {
      return next(new AppError(bankValidation.errors.join(", "), badRequest));
    }
    bankAccountData = bankValidation.data;
  }

  const updateData = { ...validation.data };
  if (bankAccountData) {
    updateData.bankAccount = bankAccountData;
  }

  if (parsedBody.profilePicture === 'null' || parsedBody.profilePicture === null) {
    updateData.profilePicture = null;
  }

  const profilePictureFile = req.file || null;

  if (profilePictureFile) {
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!validTypes.includes(profilePictureFile.mimetype)) {
      return next(new AppError("Only JPEG, PNG, and WebP images are allowed for profile pictures", badRequest));
    }
  }

  const landlord = await LandlordService.updateLandlord(
    req.params.id,
    updateData,
    req.user._id,
    req.user.role,
    req.user.agencyId || null,
    profilePictureFile
  );

  const landlordData = LandlordReturnDTO.setDTO(landlord);

  apiResponse.successResponse(
    res,
    { landlord: landlordData },
    "Landlord updated successfully",
    success
  );
});

exports.deleteLandlord = tryCatchAsync(async (req, res, next) => {
  await LandlordService.deleteLandlord(
    req.params.id,
    req.user._id,
    req.user.role,
    req.user.agencyId || null
  );

  apiResponse.successResponse(
    res,
    null,
    "Landlord deleted successfully",
    success
  );
});

exports.getLandlordsForSelect = tryCatchAsync(async (req, res, next) => {
  const landlords = await LandlordService.getLandlordsForSelect(
    req.user._id,
    req.user.agencyId || null
  );

  apiResponse.successResponse(
    res,
    { landlords },
    "Landlords retrieved successfully",
    success
  );
});

