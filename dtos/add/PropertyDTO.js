class PropertyDTO {
  static validate(data) {
    const errors = [];
    const validatedData = {};

    if (!data.landlordId || typeof data.landlordId !== 'string' || data.landlordId.trim() === '') {
      errors.push('Landlord ID is required');
    } else {
      validatedData.landlordId = data.landlordId.trim();
    }

    if (!data.title || typeof data.title !== 'string' || data.title.trim() === '') {
      errors.push('Property title is required');
    } else {
      validatedData.title = data.title.trim();
    }

    if (!data.area || isNaN(parseFloat(data.area)) || parseFloat(data.area) <= 0) {
      errors.push('Property area is required and must be a positive number');
    } else {
      validatedData.area = parseFloat(data.area);
    }

    if (!data.address || typeof data.address !== 'string' || data.address.trim() === '') {
      errors.push('Address is required');
    } else {
      validatedData.address = data.address.trim();
    }

    if (data.type) {
      const validTypes = ['APARTMENT', 'HOUSE', 'CONDO', 'TOWNHOUSE', 'DUPLEX', 'STUDIO', 'COMMERCIAL', 'RETAIL', 'OTHER'];
      if (!validTypes.includes(data.type)) {
        errors.push(`Property type must be one of: ${validTypes.join(', ')}`);
      } else {
        validatedData.type = data.type;
      }
    } else {
      validatedData.type = 'OTHER';
    }

    if (data.description) {
      validatedData.description = typeof data.description === 'string' ? data.description.trim() : String(data.description);
    }

    if (data.bedrooms !== undefined) {
      const bedrooms = parseInt(data.bedrooms);
      if (isNaN(bedrooms) || bedrooms < 0) {
        errors.push('Bedrooms must be a non-negative integer');
      } else {
        validatedData.bedrooms = bedrooms;
      }
    } else {
      validatedData.bedrooms = 0;
    }

    if (data.bathrooms !== undefined) {
      const bathrooms = parseFloat(data.bathrooms);
      if (isNaN(bathrooms) || bathrooms < 0) {
        errors.push('Bathrooms must be a non-negative number');
      } else {
        validatedData.bathrooms = bathrooms;
      }
    } else {
      validatedData.bathrooms = 0;
    }

    if (data.areaUnit) {
      const validUnits = ['SQ_FT', 'SQ_M'];
      if (!validUnits.includes(data.areaUnit)) {
        errors.push(`Area unit must be one of: ${validUnits.join(', ')}`);
      } else {
        validatedData.areaUnit = data.areaUnit;
      }
    } else {
      validatedData.areaUnit = 'SQ_FT';
    }

    if (data.yearBuilt !== undefined && data.yearBuilt !== null && data.yearBuilt !== '') {
      const yearBuilt = parseInt(data.yearBuilt);
      if (isNaN(yearBuilt) || yearBuilt < 1800 || yearBuilt > new Date().getFullYear() + 1) {
        errors.push('Year built must be a valid year');
      } else {
        validatedData.yearBuilt = yearBuilt;
      }
    }

      validatedData.furnished = data.furnished === true || data.furnished === 'true';

    validatedData.isAvailable = data.isAvailable !== false && data.isAvailable !== 'false';

    if (data.rentAmount !== undefined && data.rentAmount !== null && data.rentAmount !== '') {
      const rentAmount = parseFloat(data.rentAmount);
      if (isNaN(rentAmount) || rentAmount < 0) {
        errors.push('Rent amount must be a non-negative number');
      } else {
        validatedData.rentAmount = rentAmount;
      }
    }

    if (data.rentalCycle) {
      const validCycles = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'];
      if (!validCycles.includes(data.rentalCycle)) {
        errors.push(`Rental cycle must be one of: ${validCycles.join(', ')}`);
      } else {
        validatedData.rentalCycle = data.rentalCycle;
      }
    } else {
      validatedData.rentalCycle = 'MONTHLY';
    }

    if (data.securityDeposit !== undefined && data.securityDeposit !== null && data.securityDeposit !== '') {
      const securityDeposit = parseFloat(data.securityDeposit);
      if (isNaN(securityDeposit) || securityDeposit < 0) {
        errors.push('Security deposit must be a non-negative number');
      } else {
        validatedData.securityDeposit = securityDeposit;
      }
    }

    if (data.minimumLease !== undefined && data.minimumLease !== null && data.minimumLease !== '') {
      const minimumLease = parseInt(data.minimumLease);
      if (isNaN(minimumLease) || minimumLease < 0) {
        errors.push('Minimum lease must be a non-negative integer');
      } else {
        validatedData.minimumLease = minimumLease;
      }
    }

    if (data.maximumLease !== undefined && data.maximumLease !== null && data.maximumLease !== '') {
      const maximumLease = parseInt(data.maximumLease);
      if (isNaN(maximumLease) || maximumLease < 0) {
        errors.push('Maximum lease must be a non-negative integer');
      } else {
        validatedData.maximumLease = maximumLease;
      }
    }

    if (data.petPolicy) {
      validatedData.petPolicy = typeof data.petPolicy === 'string' ? data.petPolicy.trim() : String(data.petPolicy);
    }

    validatedData.petsAllowed = data.petsAllowed === true || data.petsAllowed === 'true';
    validatedData.smokingAllowed = data.smokingAllowed === true || data.smokingAllowed === 'true';

    if (data.maxOccupants !== undefined && data.maxOccupants !== null && data.maxOccupants !== '') {
      const maxOccupants = parseInt(data.maxOccupants);
      if (isNaN(maxOccupants) || maxOccupants < 0) {
        errors.push('Max occupants must be a non-negative integer');
      } else {
        validatedData.maxOccupants = maxOccupants;
      }
    }

    validatedData.parking = data.parking === true || data.parking === 'true';

    if (data.parkingSpaces !== undefined && data.parkingSpaces !== null && data.parkingSpaces !== '') {
      const parkingSpaces = parseInt(data.parkingSpaces);
      if (isNaN(parkingSpaces) || parkingSpaces < 0) {
        errors.push('Parking spaces must be a non-negative integer');
      } else {
        validatedData.parkingSpaces = parkingSpaces;
      }
    } else {
      validatedData.parkingSpaces = 0;
    }

    if (data.amenities) {
      validatedData.amenities = typeof data.amenities === 'string' ? data.amenities.trim() : String(data.amenities);
    }

    if (data.availableFrom) {
      const { formatDateForStorage } = require("../../utils/dateUtils");
      const availableFrom = formatDateForStorage(data.availableFrom);
      if (!availableFrom) {
        errors.push('Available from must be a valid date');
      } else {
        validatedData.availableFrom = availableFrom;
      }
    }

    // Commission fields
    if (data.commissionType) {
      const validCommissionTypes = ['PERCENTAGE', 'FIXED_AMOUNT'];
      if (!validCommissionTypes.includes(data.commissionType)) {
        errors.push(`Commission type must be one of: ${validCommissionTypes.join(', ')}`);
      } else {
        validatedData.commissionType = data.commissionType;
      }
    }

    if (data.commissionPercentage !== undefined && data.commissionPercentage !== null && data.commissionPercentage !== '') {
      const commissionPercentage = parseFloat(data.commissionPercentage);
      if (isNaN(commissionPercentage) || commissionPercentage < 0 || commissionPercentage > 100) {
        errors.push('Commission percentage must be between 0 and 100');
      } else {
        validatedData.commissionPercentage = commissionPercentage;
      }
    }

    if (data.commissionFixedAmount !== undefined && data.commissionFixedAmount !== null && data.commissionFixedAmount !== '') {
      const commissionFixedAmount = parseFloat(data.commissionFixedAmount);
      if (isNaN(commissionFixedAmount) || commissionFixedAmount < 0) {
        errors.push('Commission fixed amount must be a non-negative number');
      } else {
        validatedData.commissionFixedAmount = commissionFixedAmount;
      }
    }

    if (data.commissionFrequency) {
      const validFrequencies = ['WEEKLY', 'MONTHLY', 'BI_MONTHLY', 'QUARTERLY', 'SEMI_ANNUALLY', 'YEARLY', 'ONE_TIME', 'PER_LEASE'];
      if (!validFrequencies.includes(data.commissionFrequency)) {
        errors.push(`Commission frequency must be one of: ${validFrequencies.join(', ')}`);
      } else {
        validatedData.commissionFrequency = data.commissionFrequency;
      }
    }

    if (data.commissionNotes) {
      validatedData.commissionNotes = typeof data.commissionNotes === 'string' ? data.commissionNotes.trim()         : String(data.commissionNotes);
    }

    if (data.city) {
      validatedData.city = typeof data.city === 'string' ? data.city.trim() : String(data.city);
    }

    if (data.state) {
      validatedData.state = typeof data.state === 'string' ? data.state.trim() : String(data.state);
    }

    if (data.zipCode) {
      validatedData.zipCode = typeof data.zipCode === 'string' ? data.zipCode.trim() : String(data.zipCode);
    }

    if (data.country) {
      validatedData.country = typeof data.country === 'string' ? data.country.trim() : String(data.country);
    }

    if (data.latitude !== undefined && data.latitude !== null && data.latitude !== '') {
      const latitude = parseFloat(data.latitude);
      if (isNaN(latitude) || latitude < -90 || latitude > 90) {
        errors.push('Latitude must be between -90 and 90');
      } else {
        validatedData.latitude = latitude;
      }
    }

    if (data.longitude !== undefined && data.longitude !== null && data.longitude !== '') {
      const longitude = parseFloat(data.longitude);
      if (isNaN(longitude) || longitude < -180 || longitude > 180) {
        errors.push('Longitude must be between -180 and 180');
      } else {
        validatedData.longitude = longitude;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      data: validatedData,
    };
  }
}

module.exports = PropertyDTO;

