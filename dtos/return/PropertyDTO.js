class PropertyDTO {
  static setDTO(property) {
    const propertyData = {};

    propertyData._id = property._id;
    propertyData.agentId = property.agentId;
    propertyData.landlordId = property.landlordId;
    propertyData.agencyId = property.agencyId || null;

    if (property.landlordId && typeof property.landlordId === 'object') {
      const landlord = property.landlordId;
      if (landlord.isOrganization && landlord.organizationName) {
        propertyData.landlordName = landlord.organizationName;
      } else if (landlord.firstName || landlord.lastName) {
        propertyData.landlordName = `${landlord.firstName || ''} ${landlord.lastName || ''}`.trim();
      } else {
        propertyData.landlordName = 'Unknown Landlord';
      }
    } else {
      propertyData.landlordName = null;
    }
    propertyData.type = property.type || 'OTHER';
    propertyData.title = property.title;
    propertyData.description = property.description || null;
    propertyData.bedrooms = property.bedrooms || 0;
    propertyData.bathrooms = property.bathrooms ? parseFloat(property.bathrooms.toString()) : 0;
    propertyData.area = property.area ? parseFloat(property.area.toString()) : 0;
    propertyData.areaUnit = property.areaUnit || 'SQ_FT';
    propertyData.yearBuilt = property.yearBuilt || null;
    propertyData.furnished = property.furnished !== undefined ? property.furnished : false;
    propertyData.isAvailable = property.isAvailable !== undefined ? property.isAvailable : true;
    propertyData.rentAmount = property.rentAmount ? parseFloat(property.rentAmount.toString()) : null;
    propertyData.rentalCycle = property.rentalCycle || 'MONTHLY';
    propertyData.securityDeposit = property.securityDeposit ? parseFloat(property.securityDeposit.toString()) : null;
    propertyData.minimumLease = property.minimumLease || null;
    propertyData.maximumLease = property.maximumLease || null;
    propertyData.petPolicy = property.petPolicy || null;
    propertyData.petsAllowed = property.petsAllowed !== undefined ? property.petsAllowed : false;
    propertyData.smokingAllowed = property.smokingAllowed !== undefined ? property.smokingAllowed : false;
    propertyData.maxOccupants = property.maxOccupants || null;
    propertyData.parking = property.parking !== undefined ? property.parking : false;
    propertyData.parkingSpaces = property.parkingSpaces || 0;
    propertyData.amenities = property.amenities || null;
    const { formatDateForResponse } = require("../../utils/dateUtils");
    propertyData.availableFrom = property.availableFrom ? formatDateForResponse(property.availableFrom) : null;
    propertyData.commissionType = property.commissionType || null;
    propertyData.commissionPercentage = property.commissionPercentage ? parseFloat(property.commissionPercentage.toString()) : null;
    propertyData.commissionFixedAmount = property.commissionFixedAmount ? parseFloat(property.commissionFixedAmount.toString()) : null;
    propertyData.commissionFrequency = property.commissionFrequency || null;
    propertyData.commissionNotes = property.commissionNotes || null;
    propertyData.platformFeePercentage = property.platformFeePercentage ? parseFloat(property.platformFeePercentage.toString()) : 20.0;
    propertyData.address = property.address;
    propertyData.city = property.city || null;
    propertyData.state = property.state || null;
    propertyData.zipCode = property.zipCode || null;
    propertyData.country = property.country || null;
    propertyData.latitude = property.latitude ? parseFloat(property.latitude.toString()) : null;
    propertyData.longitude = property.longitude ? parseFloat(property.longitude.toString()) : null;
    propertyData.createdAt = property.createdAt;
    propertyData.updatedAt = property.updatedAt;

    if (property.utilities && Array.isArray(property.utilities)) {
      propertyData.utilities = property.utilities;
    } else {
      propertyData.utilities = [];
    }

    if (property.media) {
      propertyData.media = property.media;
    }

    if (property.leases) {
      propertyData.leases = property.leases;
    }

    if (property.activeLeasesCount !== undefined) {
      propertyData.activeLeasesCount = property.activeLeasesCount;
    }

    if (property.hasActiveLease !== undefined) {
      propertyData.hasActiveLease = property.hasActiveLease;
    }

    if (property.hasPendingOrDraftLease !== undefined) {
      propertyData.hasPendingOrDraftLease = property.hasPendingOrDraftLease;
    }

    if (property.landlordId && typeof property.landlordId === 'object') {
      propertyData.landlord = property.landlordId;
    }

    return propertyData;
  }

  static setDTOList(properties) {
    return properties.map(property => this.setDTO(property));
  }
}

module.exports = PropertyDTO;

