const Landlord = require("../../../models/Landlord");
const Property = require("../../../models/Property");
const Lease = require("../../../models/Lease");
const AppError = require("../../../utils/appError");
const { uploadFile, generateLandlordProfilePath, deleteFile } = require("../../../utils/s3");
const { formatDateForStorage } = require("../../../utils/dateUtils");
const PropertyReturnDTO = require("../../../dtos/return/PropertyDTO");

class LandlordService {
  static async createLandlord(data, agentId, agencyId, bankAccountData, profilePictureFile) {
    const landlordData = {
      agentId: agentId,
      agencyId: agencyId || null,
      isOrganization: data.isOrganization || false,
      organizationName: data.organizationName || null,
      organizationType: data.organizationType || null,
      firstName: data.firstName || null,
      lastName: data.lastName || null,
      contactPersonName: data.contactPersonName,
      contactPersonEmail: data.contactPersonEmail,
      contactPersonPhone: data.contactPersonPhone,
      contactPersonProfilePicture: data.contactPersonProfilePicture || null,
      vatNumber: data.vatNumber || null,
      email: data.email || null,
      phoneNumber: data.phoneNumber || null,
      profilePicture: data.profilePicture || null,
      address: data.address || null,
      city: data.city || null,
      country: data.country || null,
      postalCode: data.postalCode || null,
      assignedAt: data.assignedAt ? formatDateForStorage(data.assignedAt) : new Date(),
      bankAccount: bankAccountData ? {
        accountHolderName: bankAccountData.accountHolderName || "Not Set",
        bankName: bankAccountData.bankName || null,
        accountNumber: bankAccountData.accountNumber || null,
        branchName: bankAccountData.branchName || null,
        branchCode: bankAccountData.branchCode || null,
        iban: bankAccountData.iban || null,
        swiftCode: bankAccountData.swiftCode || null,
      } : undefined,
    };

    const landlord = await Landlord.create(landlordData);

    if (profilePictureFile && profilePictureFile.size > 0) {
      const uploadPath = generateLandlordProfilePath(landlord._id);
      const uploadResult = await uploadFile(profilePictureFile, uploadPath);

      if (uploadResult.error) {
        await Landlord.findByIdAndDelete(landlord._id);
        throw new AppError(`Failed to upload profile picture: ${uploadResult.error}`, 500);
      }

      landlord.profilePicture = uploadResult.url;
      await landlord.save();
    }

    return landlord;
  }

  static async getLandlords(filters = {}) {
    const query = {};

    if (filters.agentId) {
      query.agentId = filters.agentId;
    }

    if (filters.agencyId) {
      query.agencyId = filters.agencyId;
    }

    if (filters.isOrganization !== undefined) {
      query.isOrganization = filters.isOrganization;
    }

    if (filters.city) {
      query.city = new RegExp(filters.city, 'i');
    }

    if (filters.country) {
      query.country = new RegExp(filters.country, 'i');
    }

    const totalCount = await Landlord.countDocuments(query);

    const landlords = await Landlord.find(query)
      .populate("agentId", "firstName lastName email")
      .populate("agencyId", "name")
      .sort({ createdAt: -1 })
      .limit(filters.limit || 100)
      .skip(filters.skip || 0);

    const landlordsWithCounts = await Promise.all(
      landlords.map(async (landlord) => {
        const propertiesCount = await Property.countDocuments({ landlordId: landlord._id });
        const activeLeasesCount = await Lease.countDocuments({
          landlordId: landlord._id,
          status: 'ACTIVE',
        });

        return {
          ...landlord.toObject(),
          propertiesCount,
          activeLeasesCount,
        };
      })
    );

    return {
      landlords: landlordsWithCounts,
      totalCount,
    };
  }

  static async getLandlordById(landlordId) {
    const landlord = await Landlord.findById(landlordId);
    
    if (!landlord) {
      throw new AppError('Landlord not found', 404);
    }

    return landlord;
  }

  static async getLandlordDetailById(landlordId) {
    const landlord = await Landlord.findById(landlordId);
    
    if (!landlord) {
      throw new AppError('Landlord not found', 404);
    }

    const properties = await Property.find({ landlordId: landlord._id })
      .select('_id title type bedrooms bathrooms area areaUnit furnished address city state country createdAt updatedAt')
      .sort({ createdAt: -1 });

    const propertiesWithLeases = await Promise.all(
      properties.map(async (property) => {
        const activeLeasesCount = await Lease.countDocuments({
          propertyId: property._id,
          status: 'ACTIVE',
        });
        const propertyData = PropertyReturnDTO.setDTO(property);
        return {
          ...propertyData,
          activeLeasesCount,
        };
      })
    );

    const totalProperties = properties.length;
    const totalActiveLeases = await Lease.countDocuments({
      landlordId: landlord._id,
      status: 'ACTIVE',
    });

    const totalRentCollected = 0;
    const avgRentPerProperty = 0;

    return {
      ...landlord.toObject(),
      properties: propertiesWithLeases,
      statistics: {
        totalProperties,
        totalActiveLeases,
        totalRentCollected,
        avgRentPerProperty,
      },
    };
  }

  static async updateLandlord(landlordId, data, userId, userRole, agencyId, profilePictureFile) {
    const landlord = await Landlord.findById(landlordId);
    
    if (!landlord) {
      throw new AppError('Landlord not found', 404);
    }

    // Authorization is handled in middleware

    const updateData = {};
    
    if (data.isOrganization !== undefined) updateData.isOrganization = data.isOrganization;
    if (data.organizationName !== undefined) updateData.organizationName = data.organizationName || null;
    if (data.organizationType !== undefined) updateData.organizationType = data.organizationType || null;
    if (data.firstName !== undefined) updateData.firstName = data.firstName || null;
    if (data.lastName !== undefined) updateData.lastName = data.lastName || null;
    if (data.contactPersonName !== undefined) updateData.contactPersonName = data.contactPersonName;
    if (data.contactPersonEmail !== undefined) updateData.contactPersonEmail = data.contactPersonEmail;
    if (data.contactPersonPhone !== undefined) updateData.contactPersonPhone = data.contactPersonPhone;
    if (data.contactPersonProfilePicture !== undefined) updateData.contactPersonProfilePicture = data.contactPersonProfilePicture || null;
    if (data.vatNumber !== undefined) updateData.vatNumber = data.vatNumber || null;
    if (data.email !== undefined) updateData.email = data.email || null;
    if (data.phoneNumber !== undefined) updateData.phoneNumber = data.phoneNumber || null;
    if (data.profilePicture !== undefined) updateData.profilePicture = data.profilePicture || null;
    if (data.address !== undefined) updateData.address = data.address || null;
    if (data.city !== undefined) updateData.city = data.city || null;
    if (data.country !== undefined) updateData.country = data.country || null;
    if (data.postalCode !== undefined) updateData.postalCode = data.postalCode || null;
    if (data.assignedAt !== undefined) updateData.assignedAt = data.assignedAt ? formatDateForStorage(data.assignedAt) : null;
    if (data.bankAccount !== undefined) {
      updateData.bankAccount = {
        accountHolderName: data.bankAccount.accountHolderName || "Not Set",
        bankName: data.bankAccount.bankName || null,
        accountNumber: data.bankAccount.accountNumber || null,
        branchName: data.bankAccount.branchName || null,
        branchCode: data.bankAccount.branchCode || null,
        iban: data.bankAccount.iban || null,
        swiftCode: data.bankAccount.swiftCode || null,
      };
    }

    let profilePictureUrl = landlord.profilePicture;
    if (profilePictureFile && profilePictureFile.size > 0) {
      if (landlord.profilePicture) {
        try {
          const oldFilePath = generateLandlordProfilePath(landlordId);
          await deleteFile(oldFilePath);
        } catch (error) {
          console.warn("Failed to delete old profile picture:", error);
        }
      }

      const uploadPath = generateLandlordProfilePath(landlordId);
      const uploadResult = await uploadFile(profilePictureFile, uploadPath);

      if (uploadResult.error) {
        throw new AppError(`Failed to upload profile picture: ${uploadResult.error}`, 500);
      }

      profilePictureUrl = uploadResult.url;
      updateData.profilePicture = profilePictureUrl;
    } else if (data.profilePicture === null || data.profilePicture === 'null') {
      if (landlord.profilePicture) {
        try {
          const oldFilePath = generateLandlordProfilePath(landlordId);
          await deleteFile(oldFilePath);
        } catch (error) {
          console.warn("Failed to delete old profile picture:", error);
        }
      }
      updateData.profilePicture = null;
    }

    const updatedLandlord = await Landlord.findByIdAndUpdate(
      landlordId,
      updateData,
      { new: true, runValidators: true }
    );

    return updatedLandlord;
  }

  static async deleteLandlord(landlordId, userId, userRole, agencyId) {
    const landlord = await Landlord.findById(landlordId);
    
    if (!landlord) {
      throw new AppError('Landlord not found', 404);
    }

    // Authorization is handled in middleware

    await Landlord.findByIdAndDelete(landlordId);
    return true;
  }

  static async getLandlordsForSelect(agentId, agencyId) {
    const query = {};
    
    if (agencyId) {
      query.agencyId = agencyId;
    } else {
      query.agentId = agentId;
    }

    const landlords = await Landlord.find(query)
      .select('_id firstName lastName organizationName isOrganization')
      .sort({ createdAt: -1 });

    return landlords.map(landlord => ({
      _id: landlord._id,
      firstName: landlord.firstName,
      lastName: landlord.lastName,
      isOrganization: landlord.isOrganization,
      organizationName: landlord.organizationName,
    }));
  }
}

module.exports = LandlordService;

