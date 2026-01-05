class TenantDTO {
  static validate(data) {
    const errors = [];
    const validatedData = {};

    if (!data.firstName || typeof data.firstName !== "string" || data.firstName.trim().length === 0) {
      errors.push("First name is required");
    } else {
      validatedData.firstName = data.firstName.trim();
    }

    if (!data.lastName || typeof data.lastName !== "string" || data.lastName.trim().length === 0) {
      errors.push("Last name is required");
    } else {
      validatedData.lastName = data.lastName.trim();
    }

    if (data.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        errors.push("Invalid email format");
      } else {
        validatedData.email = data.email.toLowerCase().trim();
      }
    }

    if (data.phoneNumber) {
      validatedData.phoneNumber = data.phoneNumber.trim();
    }

    if (data.profilePicture) {
      validatedData.profilePicture = data.profilePicture;
    }

    if (data.address) {
      validatedData.address = data.address.trim();
    }

    if (data.city) {
      validatedData.city = data.city.trim();
    }

    if (data.country) {
      validatedData.country = data.country.trim();
    }

    if (data.postalCode) {
      validatedData.postalCode = data.postalCode.trim();
    }

    if (data.dateOfBirth) {
      const date = new Date(data.dateOfBirth);
      if (isNaN(date.getTime())) {
        errors.push("Invalid date of birth");
      } else {
        validatedData.dateOfBirth = date;
      }
    }

    if (data.idNumber) {
      validatedData.idNumber = data.idNumber.trim();
    }

    if (data.idType) {
      const validIdTypes = ["PASSPORT", "NATIONAL_ID", "DRIVERS_LICENSE", "OTHER"];
      if (!validIdTypes.includes(data.idType)) {
        errors.push("Invalid ID type. Must be one of: PASSPORT, NATIONAL_ID, DRIVERS_LICENSE, OTHER");
      } else {
        validatedData.idType = data.idType;
      }
    }

    if (data.emergencyContactName) {
      validatedData.emergencyContactName = data.emergencyContactName.trim();
    }

    if (data.emergencyContactPhone) {
      validatedData.emergencyContactPhone = data.emergencyContactPhone.trim();
    }

    if (data.emergencyContactRelationship) {
      validatedData.emergencyContactRelationship = data.emergencyContactRelationship.trim();
    }

    if (data.notes) {
      validatedData.notes = data.notes.trim();
    }

    return {
      isValid: errors.length === 0,
      errors,
      data: validatedData,
    };
  }
}

module.exports = TenantDTO;

