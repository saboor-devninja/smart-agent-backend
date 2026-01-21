const { formatDateForResponse } = require("../../utils/dateUtils");

class LandlordDTO {
  static setDTO(landlord) {
    const landlordData = {};

    landlordData._id = landlord._id;
    landlordData.docNumber = landlord.docNumber || null;
    
    // Store only ID strings, not populated objects (null-safe)
    landlordData.agentId = (landlord.agentId && typeof landlord.agentId === 'object' && landlord.agentId._id) ? landlord.agentId._id : (landlord.agentId || null);
    landlordData.agencyId = (landlord.agencyId && typeof landlord.agencyId === 'object' && landlord.agencyId._id) ? landlord.agencyId._id : (landlord.agencyId || null);
    landlordData.isOrganization = landlord.isOrganization !== undefined ? landlord.isOrganization : false;
    landlordData.organizationName = landlord.organizationName || null;
    landlordData.organizationType = landlord.organizationType || null;
    landlordData.firstName = landlord.firstName || null;
    landlordData.lastName = landlord.lastName || null;
    landlordData.contactPersonName = landlord.contactPersonName;
    landlordData.contactPersonEmail = landlord.contactPersonEmail;
    landlordData.contactPersonPhone = landlord.contactPersonPhone;
    landlordData.contactPersonProfilePicture = landlord.contactPersonProfilePicture || null;
    landlordData.vatNumber = landlord.vatNumber || null;
    landlordData.email = landlord.email || null;
    landlordData.phoneNumber = landlord.phoneNumber || null;
    landlordData.profilePicture = landlord.profilePicture || null;
    landlordData.address = landlord.address || null;
    landlordData.city = landlord.city || null;
    landlordData.country = landlord.country || null;
    landlordData.postalCode = landlord.postalCode || null;
    landlordData.assignedAt = landlord.assignedAt ? formatDateForResponse(landlord.assignedAt) : null;
    landlordData.assignedBy = landlord.assignedBy || null;
    landlordData.bankAccount = landlord.bankAccount || null;
    landlordData.createdAt = landlord.createdAt;
    landlordData.updatedAt = landlord.updatedAt;

    if (landlord.propertiesCount !== undefined) {
      landlordData.propertiesCount = landlord.propertiesCount;
    }

    if (landlord.activeLeasesCount !== undefined) {
      landlordData.activeLeasesCount = landlord.activeLeasesCount;
    }

    return landlordData;
  }

  static setDTOList(landlords) {
    return landlords.map(landlord => this.setDTO(landlord));
  }

  static getDisplayName(landlord) {
    if (landlord.isOrganization && landlord.organizationName) {
      return landlord.organizationName;
    }
    if (landlord.firstName || landlord.lastName) {
      return `${landlord.firstName || ''} ${landlord.lastName || ''}`.trim();
    }
    return landlord.contactPersonName || 'Unknown Landlord';
  }
}

module.exports = LandlordDTO;

