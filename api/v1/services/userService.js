const User = require("../../../models/User");
const AppError = require("../../../utils/appError");
const { uploadFile, deleteFile, generateUserProfilePath } = require("../../../utils/s3");

class UserService {
  static async updateProfile(userId, data, profilePictureFile, companyLogoFile) {
    const user = await User.findById(userId);

    if (!user) {
      throw new AppError("User not found", 404);
    }

    const updateData = {};

    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.email !== undefined) updateData.email = data.email.toLowerCase();
    if (data.phone !== undefined) updateData.phone = data.phone || null;
    if (data.city !== undefined) updateData.city = data.city || null;
    if (data.country !== undefined) updateData.country = data.country || null;
    if (data.currency !== undefined) updateData.currency = data.currency || "USD";
    if (data.currencySymbol !== undefined) updateData.currencySymbol = data.currencySymbol || "$";
    if (data.currencyLocale !== undefined) updateData.currencyLocale = data.currencyLocale || "en-US";

    if (user.role === "AGENT") {
      if (data.companyName !== undefined) updateData.companyName = data.companyName || null;
      if (data.companyRegistration !== undefined) updateData.companyRegistration = data.companyRegistration || null;
      if (data.companyAddress !== undefined) updateData.companyAddress = data.companyAddress || null;
      if (data.companyWebsite !== undefined) updateData.companyWebsite = data.companyWebsite || null;
    }

    if (profilePictureFile && profilePictureFile.size > 0) {
      if (user.profilePicture) {
        try {
          const oldFilePath = generateUserProfilePath(userId);
          await deleteFile(oldFilePath);
        } catch (error) {
          console.warn("Failed to delete old profile picture:", error);
        }
      }

      const uploadPath = generateUserProfilePath(userId);
      const uploadResult = await uploadFile(profilePictureFile, uploadPath);

      if (uploadResult.error) {
        throw new AppError(`Failed to upload profile picture: ${uploadResult.error}`, 500);
      }

      updateData.profilePicture = uploadResult.url;
    } else if (data.profilePicture === null || data.profilePicture === "null") {
      if (user.profilePicture) {
        try {
          const oldFilePath = generateUserProfilePath(userId);
          await deleteFile(oldFilePath);
        } catch (error) {
          console.warn("Failed to delete old profile picture:", error);
        }
      }
      updateData.profilePicture = null;
    }

    if (companyLogoFile && companyLogoFile.size > 0 && user.role === "AGENT") {
      if (user.companyLogo) {
        try {
          const oldLogoPath = `users/${userId}/company-logo`;
          await deleteFile(oldLogoPath);
        } catch (error) {
          console.warn("Failed to delete old company logo:", error);
        }
      }

      const uploadPath = `users/${userId}/company-logo`;
      const uploadResult = await uploadFile(companyLogoFile, uploadPath);

      if (uploadResult.error) {
        throw new AppError(`Failed to upload company logo: ${uploadResult.error}`, 500);
      }

      updateData.companyLogo = uploadResult.url;
    } else if (data.companyLogo === null || data.companyLogo === "null") {
      if (user.companyLogo && user.role === "AGENT") {
        try {
          const oldLogoPath = `users/${userId}/company-logo`;
          await deleteFile(oldLogoPath);
        } catch (error) {
          console.warn("Failed to delete old company logo:", error);
        }
      }
      updateData.companyLogo = null;
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    });

    return updatedUser;
  }

  static async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId).select("+password");

    if (!user) {
      throw new AppError("User not found", 404);
    }

    if (!currentPassword || !newPassword) {
      throw new AppError("Current password and new password are required", 400);
    }

    if (newPassword.length < 6) {
      throw new AppError("New password must be at least 6 characters long", 400);
    }

    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    if (!isCurrentPasswordValid) {
      throw new AppError("Current password is incorrect", 401);
    }

    user.password = newPassword;
    await user.save();

    user.password = undefined;

    return user;
  }
}

module.exports = UserService;

