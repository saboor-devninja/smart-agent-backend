class LandlordDTO {
  static validate(data) {
    const errors = [];
    const validatedData = {};

    validatedData.isOrganization = data.isOrganization === true || data.isOrganization === 'true';

    if (validatedData.isOrganization) {
      if (!data.organizationName || typeof data.organizationName !== 'string' || data.organizationName.trim() === '') {
        errors.push('Organization name is required for organizations');
      } else {
        const orgName = data.organizationName.trim();
        if (orgName.length > 100) {
          errors.push('Organization name must be less than 100 characters');
        } else {
          validatedData.organizationName = orgName;
        }
      }

      if (data.organizationType) {
        const orgType = data.organizationType.trim();
        if (orgType.length > 50) {
          errors.push('Organization type must be less than 50 characters');
        } else {
          validatedData.organizationType = orgType;
        }
      }
    } else {
      if (!data.firstName || typeof data.firstName !== 'string' || data.firstName.trim() === '') {
        errors.push('First name is required for individual landlords');
      } else {
        const firstName = data.firstName.trim();
        if (firstName.length > 50) {
          errors.push('First name must be less than 50 characters');
        } else {
          validatedData.firstName = firstName;
        }
      }

      if (!data.lastName || typeof data.lastName !== 'string' || data.lastName.trim() === '') {
        errors.push('Last name is required for individual landlords');
      } else {
        const lastName = data.lastName.trim();
        if (lastName.length > 50) {
          errors.push('Last name must be less than 50 characters');
        } else {
          validatedData.lastName = lastName;
        }
      }
    }

    if (!data.contactPersonName || typeof data.contactPersonName !== 'string' || data.contactPersonName.trim() === '') {
      errors.push('Contact person name is required');
    } else {
      const contactName = data.contactPersonName.trim();
      if (contactName.length > 100) {
        errors.push('Contact person name must be less than 100 characters');
      } else {
        validatedData.contactPersonName = contactName;
      }
    }

    if (!data.contactPersonEmail || typeof data.contactPersonEmail !== 'string' || data.contactPersonEmail.trim() === '') {
      errors.push('Contact person email is required');
    } else {
      const email = data.contactPersonEmail.trim().toLowerCase();
      const emailRegex = /^\S+@\S+\.\S+$/;
      if (!emailRegex.test(email)) {
        errors.push('Please enter a valid contact person email address');
      } else {
        validatedData.contactPersonEmail = email;
      }
    }

    if (!data.contactPersonPhone || typeof data.contactPersonPhone !== 'string' || data.contactPersonPhone.trim() === '') {
      errors.push('Contact person phone is required');
    } else {
      validatedData.contactPersonPhone = data.contactPersonPhone.trim();
    }

    if (data.contactPersonProfilePicture) {
      validatedData.contactPersonProfilePicture = typeof data.contactPersonProfilePicture === 'string' 
        ? data.contactPersonProfilePicture.trim() 
        : String(data.contactPersonProfilePicture);
    }

    if (data.vatNumber) {
      const vatNumber = data.vatNumber.trim();
      if (vatNumber.length > 50) {
        errors.push('VAT number must be less than 50 characters');
      } else {
        validatedData.vatNumber = vatNumber;
      }
    }

    if (data.email) {
      const email = data.email.trim().toLowerCase();
      if (email !== '') {
        const emailRegex = /^\S+@\S+\.\S+$/;
        if (!emailRegex.test(email)) {
          errors.push('Please enter a valid email address');
        } else {
          validatedData.email = email;
        }
      }
    }

    if (data.phoneNumber) {
      validatedData.phoneNumber = data.phoneNumber.trim();
    }

    if (data.profilePicture) {
      validatedData.profilePicture = typeof data.profilePicture === 'string' 
        ? data.profilePicture.trim() 
        : String(data.profilePicture);
    }

    if (data.address) {
      const address = data.address.trim();
      if (address.length > 200) {
        errors.push('Address must be less than 200 characters');
      } else {
        validatedData.address = address;
      }
    }

    if (data.city) {
      const city = data.city.trim();
      if (city.length > 100) {
        errors.push('City must be less than 100 characters');
      } else {
        validatedData.city = city;
      }
    }

    if (data.country) {
      const country = data.country.trim();
      if (country.length > 100) {
        errors.push('Country must be less than 100 characters');
      } else {
        validatedData.country = country;
      }
    }

    if (data.postalCode) {
      const postalCode = data.postalCode.trim();
      if (postalCode.length > 20) {
        errors.push('Postal code must be less than 20 characters');
      } else {
        validatedData.postalCode = postalCode;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      data: validatedData,
    };
  }

  static validateBankAccount(data) {
    const errors = [];
    const validatedData = {};

    if (!data.accountHolderName || typeof data.accountHolderName !== 'string' || data.accountHolderName.trim() === '') {
      errors.push('Account holder name is required');
    } else {
      validatedData.accountHolderName = data.accountHolderName.trim();
    }

    if (!data.bankName || typeof data.bankName !== 'string' || data.bankName.trim() === '') {
      errors.push('Bank name is required');
    } else {
      validatedData.bankName = data.bankName.trim();
    }

    if (!data.accountNumber || typeof data.accountNumber !== 'string' || data.accountNumber.trim() === '') {
      errors.push('Account number is required');
    } else {
      validatedData.accountNumber = data.accountNumber.trim();
    }

    if (data.branchName) {
      validatedData.branchName = data.branchName.trim();
    }

    if (data.branchCode) {
      validatedData.branchCode = data.branchCode.trim();
    }

    if (data.iban) {
      validatedData.iban = data.iban.trim().toUpperCase();
    }

    if (data.swiftCode) {
      validatedData.swiftCode = data.swiftCode.trim().toUpperCase();
    }

    return {
      isValid: errors.length === 0,
      errors,
      data: validatedData,
    };
  }
}

module.exports = LandlordDTO;

