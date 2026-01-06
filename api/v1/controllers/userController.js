const UserService = require("../services/userService");
const UserDTO = require("../../../dtos/return/UserDTO");
const tryCatchAsync = require("../../../utils/tryCatchAsync");
const apiResponse = require("../../../utils/apiResponse");
const AppError = require("../../../utils/appError");
const { success, badRequest } = require("../../../utils/statusCode").statusCode;
const { parseNestedFormData } = require("../../../utils/parseFormData");

exports.updateProfile = tryCatchAsync(async (req, res, next) => {
  const parsedBody = parseNestedFormData(req.body);

  if (!parsedBody.firstName || !parsedBody.lastName || !parsedBody.email) {
    return next(new AppError("First name, last name, and email are required", badRequest));
  }

  const profilePictureFile = req.files?.profilePicture?.[0] || null;
  const companyLogoFile = req.files?.companyLogo?.[0] || null;

  if (profilePictureFile) {
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!validTypes.includes(profilePictureFile.mimetype)) {
      return next(
        new AppError("Only JPEG, PNG, and WebP images are allowed for profile pictures", badRequest)
      );
    }
  }

  if (companyLogoFile) {
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!validTypes.includes(companyLogoFile.mimetype)) {
      return next(
        new AppError("Only JPEG, PNG, and WebP images are allowed for company logos", badRequest)
      );
    }
  }

  const user = await UserService.updateProfile(
    req.user._id,
    parsedBody,
    profilePictureFile,
    companyLogoFile
  );

  const userData = UserDTO.setDTO(user);

  return apiResponse.successResponse(
    res,
    { user: userData },
    "Profile updated successfully",
    success
  );
});

exports.changePassword = tryCatchAsync(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return next(new AppError("Current password and new password are required", badRequest));
  }

  await UserService.changePassword(req.user._id, currentPassword, newPassword);

  return apiResponse.successResponse(
    res,
    {},
    "Password changed successfully",
    success
  );
});

