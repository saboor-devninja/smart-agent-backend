class LeaseDTO {
  static validate(data) {
    const errors = [];
    const validatedData = {};

    if (!data.propertyId || typeof data.propertyId !== 'string' || data.propertyId.trim() === '') {
      errors.push('Property ID is required');
    } else {
      validatedData.propertyId = data.propertyId.trim();
    }

    if (data.tenantId && typeof data.tenantId === 'string' && data.tenantId.trim() !== '') {
      validatedData.tenantId = data.tenantId.trim();
    } else if (data.tenantFirstName && data.tenantLastName) {
      if (!data.tenantFirstName || typeof data.tenantFirstName !== 'string' || data.tenantFirstName.trim() === '') {
        errors.push('Tenant first name is required');
      }
      if (!data.tenantLastName || typeof data.tenantLastName !== 'string' || data.tenantLastName.trim() === '') {
        errors.push('Tenant last name is required');
      }
      if (data.tenantEmail) {
        const email = data.tenantEmail.trim().toLowerCase();
        const emailRegex = /^\S+@\S+\.\S+$/;
        if (!emailRegex.test(email)) {
          errors.push('Please enter a valid tenant email address');
        }
      }
      if (errors.length === 0) {
        validatedData.tenantFirstName = data.tenantFirstName.trim();
        validatedData.tenantLastName = data.tenantLastName.trim();
        validatedData.tenantEmail = data.tenantEmail ? data.tenantEmail.trim().toLowerCase() : null;
        validatedData.tenantPhoneNumber = data.tenantPhoneNumber ? data.tenantPhoneNumber.trim() : null;
      }
    } else {
      errors.push('Either Tenant ID or Tenant information (firstName, lastName) is required');
    }

    if (!data.rentAmount || isNaN(parseFloat(data.rentAmount)) || parseFloat(data.rentAmount) <= 0) {
      errors.push('Rent amount is required and must be greater than 0');
    } else {
      validatedData.rentAmount = parseFloat(data.rentAmount);
    }

    if (data.rentFrequency) {
      const validFrequencies = ['MONTHLY', 'QUARTERLY', 'YEARLY'];
      if (!validFrequencies.includes(data.rentFrequency)) {
        errors.push(`Rent frequency must be one of: ${validFrequencies.join(', ')}`);
      } else {
        validatedData.rentFrequency = data.rentFrequency;
      }
    } else {
      validatedData.rentFrequency = 'MONTHLY';
    }

    if (data.dueDay !== undefined && data.dueDay !== null) {
      const dueDay = parseInt(data.dueDay);
      if (isNaN(dueDay) || dueDay < 1 || dueDay > 31) {
        errors.push('Due day must be between 1 and 31');
      } else {
        validatedData.dueDay = dueDay;
      }
    } else {
      errors.push('Due day is required');
    }

    if (data.startDate) {
      const startDate = new Date(data.startDate);
      if (isNaN(startDate.getTime())) {
        errors.push('Invalid start date');
      } else {
        validatedData.startDate = startDate;
      }
    } else {
      errors.push('Start date is required');
    }

    if (data.leaseDuration !== undefined && data.leaseDuration !== null) {
      const duration = parseInt(data.leaseDuration);
      if (isNaN(duration) || duration < 1 || duration > 120) {
        errors.push('Lease duration must be between 1 and 120 months');
      } else {
        validatedData.leaseDuration = duration;
      }
    } else {
      errors.push('Lease duration is required');
    }

    if (!data.securityDeposit || isNaN(parseFloat(data.securityDeposit)) || parseFloat(data.securityDeposit) <= 0) {
      errors.push('Security deposit is required and must be greater than 0');
    } else {
      validatedData.securityDeposit = parseFloat(data.securityDeposit);
    }

    if (data.status) {
      const validStatuses = ['DRAFT', 'PENDING_START', 'ACTIVE', 'TERMINATED', 'CANCELLED'];
      if (!validStatuses.includes(data.status)) {
        errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
      } else {
        validatedData.status = data.status;
      }
    } else {
      validatedData.status = 'DRAFT';
    }

    if (data.lateFeeEnabled !== undefined) {
      validatedData.lateFeeEnabled = data.lateFeeEnabled === true || data.lateFeeEnabled === 'true';
    } else {
      validatedData.lateFeeEnabled = false;
    }

    if (data.lateFeeEnabled) {
      if (data.lateFeeType) {
        const validLateFeeTypes = ['FIXED_AMOUNT', 'PERCENTAGE', 'DAILY_RATE'];
        if (!validLateFeeTypes.includes(data.lateFeeType)) {
          errors.push(`Late fee type must be one of: ${validLateFeeTypes.join(', ')}`);
        } else {
          validatedData.lateFeeType = data.lateFeeType;
        }
      } else {
        validatedData.lateFeeType = 'FIXED_AMOUNT';
      }

      if (data.lateFee !== undefined && data.lateFee !== null && data.lateFee !== '') {
        const lateFee = parseFloat(data.lateFee);
        if (isNaN(lateFee) || lateFee < 0) {
          errors.push('Late fee must be 0 or greater');
        } else {
          validatedData.lateFee = lateFee;
        }
      }

      if (data.lateFeePercentage !== undefined && data.lateFeePercentage !== null && data.lateFeePercentage !== '') {
        const lateFeePercentage = parseFloat(data.lateFeePercentage);
        if (isNaN(lateFeePercentage) || lateFeePercentage < 0 || lateFeePercentage > 100) {
          errors.push('Late fee percentage must be between 0 and 100');
        } else {
          validatedData.lateFeePercentage = lateFeePercentage;
        }
      }

      if (data.lateFeeDays !== undefined && data.lateFeeDays !== null) {
        const lateFeeDays = parseInt(data.lateFeeDays);
        if (isNaN(lateFeeDays) || lateFeeDays < 1 || lateFeeDays > 30) {
          errors.push('Late fee days must be between 1 and 30');
        } else {
          validatedData.lateFeeDays = lateFeeDays;
        }
      } else {
        validatedData.lateFeeDays = 5;
      }
    }

    if (data.petDeposit !== undefined && data.petDeposit !== null && data.petDeposit !== '') {
      const petDeposit = parseFloat(data.petDeposit);
      if (isNaN(petDeposit) || petDeposit < 0) {
        errors.push('Pet deposit must be 0 or greater');
      } else {
        validatedData.petDeposit = petDeposit;
      }
    }

    if (data.autoRenewal !== undefined) {
      validatedData.autoRenewal = data.autoRenewal === true || data.autoRenewal === 'true';
    } else {
      validatedData.autoRenewal = false;
    }

    if (data.renewalNotice !== undefined && data.renewalNotice !== null) {
      const renewalNotice = parseInt(data.renewalNotice);
      if (isNaN(renewalNotice) || renewalNotice < 1 || renewalNotice > 365) {
        errors.push('Renewal notice must be between 1 and 365 days');
      } else {
        validatedData.renewalNotice = renewalNotice;
      }
    } else {
      validatedData.renewalNotice = 30;
    }

    if (data.terminationNotice !== undefined && data.terminationNotice !== null) {
      const terminationNotice = parseInt(data.terminationNotice);
      if (isNaN(terminationNotice) || terminationNotice < 1 || terminationNotice > 365) {
        errors.push('Termination notice must be between 1 and 365 days');
      } else {
        validatedData.terminationNotice = terminationNotice;
      }
    } else {
      validatedData.terminationNotice = 30;
    }

    if (data.earlyTerminationFee !== undefined && data.earlyTerminationFee !== null && data.earlyTerminationFee !== '') {
      const earlyTerminationFee = parseFloat(data.earlyTerminationFee);
      if (isNaN(earlyTerminationFee) || earlyTerminationFee < 0) {
        errors.push('Early termination fee must be 0 or greater');
      } else {
        validatedData.earlyTerminationFee = earlyTerminationFee;
      }
    }

    if (data.signedAt) {
      // Keep as string to let formatDateForStorage handle UTC conversion
      if (typeof data.signedAt === 'string') {
        validatedData.signedAt = data.signedAt;
      } else if (data.signedAt instanceof Date) {
        // If already a Date, convert to string first
        const year = data.signedAt.getUTCFullYear();
        const month = String(data.signedAt.getUTCMonth() + 1).padStart(2, '0');
        const day = String(data.signedAt.getUTCDate()).padStart(2, '0');
        validatedData.signedAt = `${year}-${month}-${day}`;
      } else {
        errors.push('Invalid signed at date');
      }
    }

    if (data.witnessName) {
      validatedData.witnessName = typeof data.witnessName === 'string' ? data.witnessName.trim() : String(data.witnessName);
    }

    if (data.notes) {
      validatedData.notes = typeof data.notes === 'string' ? data.notes.trim() : String(data.notes);
    }

    if (data.endDate) {
      // Keep as string to let formatDateForStorage handle UTC conversion
      if (typeof data.endDate === 'string') {
        validatedData.endDate = data.endDate;
        if (validatedData.startDate) {
          const startDate = new Date(validatedData.startDate);
          const endDate = new Date(data.endDate);
          if (endDate <= startDate) {
            errors.push('End date must be after start date');
          }
        }
      } else {
        errors.push('Invalid end date');
      }
    }

    if (data.platformCommissionOverride !== undefined) {
      validatedData.platformCommissionOverride = data.platformCommissionOverride === true || data.platformCommissionOverride === 'true';
    } else {
      validatedData.platformCommissionOverride = false;
    }

    if (data.platformCommissionOverride) {
      if (data.platformCommissionType) {
        const validTypes = ['PERCENTAGE', 'FIXED'];
        if (!validTypes.includes(data.platformCommissionType)) {
          errors.push(`Platform commission type must be one of: ${validTypes.join(', ')}`);
        } else {
          validatedData.platformCommissionType = data.platformCommissionType;
        }
      }

      if (data.platformCommissionRate !== undefined && data.platformCommissionRate !== null && data.platformCommissionRate !== '') {
        const rate = parseFloat(data.platformCommissionRate);
        if (isNaN(rate) || rate < 0 || rate > 100) {
          errors.push('Platform commission rate must be between 0 and 100');
        } else {
          validatedData.platformCommissionRate = rate;
        }
      }

      if (data.platformCommissionFixed !== undefined && data.platformCommissionFixed !== null && data.platformCommissionFixed !== '') {
        const fixed = parseFloat(data.platformCommissionFixed);
        if (isNaN(fixed) || fixed < 0) {
          errors.push('Platform commission fixed amount must be 0 or greater');
        } else {
          validatedData.platformCommissionFixed = fixed;
        }
      }
    }

    if (data.agencyCommissionEnabled !== undefined) {
      validatedData.agencyCommissionEnabled = data.agencyCommissionEnabled === true || data.agencyCommissionEnabled === 'true';
    } else {
      validatedData.agencyCommissionEnabled = false;
    }

    if (data.agencyCommissionEnabled) {
      if (data.agencyCommissionType) {
        const validTypes = ['PERCENTAGE', 'FIXED'];
        if (!validTypes.includes(data.agencyCommissionType)) {
          errors.push(`Agency commission type must be one of: ${validTypes.join(', ')}`);
        } else {
          validatedData.agencyCommissionType = data.agencyCommissionType;
        }
      }

      if (data.agencyCommissionRate !== undefined && data.agencyCommissionRate !== null && data.agencyCommissionRate !== '') {
        const rate = parseFloat(data.agencyCommissionRate);
        if (isNaN(rate) || rate < 0 || rate > 100) {
          errors.push('Agency commission rate must be between 0 and 100');
        } else {
          validatedData.agencyCommissionRate = rate;
        }
      }

      if (data.agencyCommissionFixed !== undefined && data.agencyCommissionFixed !== null && data.agencyCommissionFixed !== '') {
        const fixed = parseFloat(data.agencyCommissionFixed);
        if (isNaN(fixed) || fixed < 0) {
          errors.push('Agency commission fixed amount must be 0 or greater');
        } else {
          validatedData.agencyCommissionFixed = fixed;
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
      data: validatedData,
    };
  }

  static validateForUpdate(data) {
    const errors = [];
    const validatedData = {};

    if (data.propertyId !== undefined) {
      if (!data.propertyId || typeof data.propertyId !== 'string' || data.propertyId.trim() === '') {
        errors.push('Property ID cannot be empty');
      } else {
        validatedData.propertyId = data.propertyId.trim();
      }
    }

    if (data.tenantId !== undefined) {
      if (!data.tenantId || typeof data.tenantId !== 'string' || data.tenantId.trim() === '') {
        errors.push('Tenant ID cannot be empty');
      } else {
        validatedData.tenantId = data.tenantId.trim();
      }
    }

    if (data.rentAmount !== undefined) {
      if (isNaN(parseFloat(data.rentAmount)) || parseFloat(data.rentAmount) <= 0) {
        errors.push('Rent amount must be greater than 0');
      } else {
        validatedData.rentAmount = parseFloat(data.rentAmount);
      }
    }

    if (data.rentFrequency !== undefined) {
      const validFrequencies = ['MONTHLY', 'QUARTERLY', 'YEARLY'];
      if (!validFrequencies.includes(data.rentFrequency)) {
        errors.push(`Rent frequency must be one of: ${validFrequencies.join(', ')}`);
      } else {
        validatedData.rentFrequency = data.rentFrequency;
      }
    }

    if (data.dueDay !== undefined && data.dueDay !== null) {
      const dueDay = parseInt(data.dueDay);
      if (isNaN(dueDay) || dueDay < 1 || dueDay > 31) {
        errors.push('Due day must be between 1 and 31');
      } else {
        validatedData.dueDay = dueDay;
      }
    }

    if (data.startDate !== undefined) {
      // Keep as string to let formatDateForStorage handle UTC conversion
      if (typeof data.startDate === 'string') {
        validatedData.startDate = data.startDate;
      } else if (data.startDate instanceof Date) {
        // If already a Date, convert to string first
        const year = data.startDate.getUTCFullYear();
        const month = String(data.startDate.getUTCMonth() + 1).padStart(2, '0');
        const day = String(data.startDate.getUTCDate()).padStart(2, '0');
        validatedData.startDate = `${year}-${month}-${day}`;
      } else {
        errors.push('Invalid start date');
      }
    }

    if (data.leaseDuration !== undefined && data.leaseDuration !== null) {
      const duration = parseInt(data.leaseDuration);
      if (isNaN(duration) || duration < 1 || duration > 120) {
        errors.push('Lease duration must be between 1 and 120 months');
      } else {
        validatedData.leaseDuration = duration;
      }
    }

    if (data.securityDeposit !== undefined) {
      if (isNaN(parseFloat(data.securityDeposit)) || parseFloat(data.securityDeposit) <= 0) {
        errors.push('Security deposit must be greater than 0');
      } else {
        validatedData.securityDeposit = parseFloat(data.securityDeposit);
      }
    }

    if (data.status !== undefined) {
      const validStatuses = ['DRAFT', 'PENDING_START', 'ACTIVE', 'TERMINATED', 'CANCELLED'];
      if (!validStatuses.includes(data.status)) {
        errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
      } else {
        validatedData.status = data.status;
      }
    }

    if (data.endDate !== undefined) {
      if (data.endDate) {
        // Keep as string to let formatDateForStorage handle UTC conversion
        if (typeof data.endDate === 'string') {
          validatedData.endDate = data.endDate;
          if (validatedData.startDate) {
            const startDate = new Date(validatedData.startDate);
            const endDate = new Date(data.endDate);
            if (endDate <= startDate) {
              errors.push('End date must be after start date');
            }
          }
        } else {
          errors.push('Invalid end date');
        }
      } else {
        validatedData.endDate = null;
      }
    }

    if (data.lateFeeEnabled !== undefined) {
      validatedData.lateFeeEnabled = data.lateFeeEnabled === true || data.lateFeeEnabled === 'true';
    }

    if (data.lateFeeEnabled) {
      if (data.lateFeeType !== undefined) {
        const validLateFeeTypes = ['FIXED_AMOUNT', 'PERCENTAGE', 'DAILY_RATE'];
        if (!validLateFeeTypes.includes(data.lateFeeType)) {
          errors.push(`Late fee type must be one of: ${validLateFeeTypes.join(', ')}`);
        } else {
          validatedData.lateFeeType = data.lateFeeType;
        }
      }

      if (data.lateFee !== undefined && data.lateFee !== null && data.lateFee !== '') {
        const lateFee = parseFloat(data.lateFee);
        if (isNaN(lateFee) || lateFee < 0) {
          errors.push('Late fee must be 0 or greater');
        } else {
          validatedData.lateFee = lateFee;
        }
      }

      if (data.lateFeePercentage !== undefined && data.lateFeePercentage !== null && data.lateFeePercentage !== '') {
        const lateFeePercentage = parseFloat(data.lateFeePercentage);
        if (isNaN(lateFeePercentage) || lateFeePercentage < 0 || lateFeePercentage > 100) {
          errors.push('Late fee percentage must be between 0 and 100');
        } else {
          validatedData.lateFeePercentage = lateFeePercentage;
        }
      }

      if (data.lateFeeDays !== undefined && data.lateFeeDays !== null) {
        const lateFeeDays = parseInt(data.lateFeeDays);
        if (isNaN(lateFeeDays) || lateFeeDays < 1 || lateFeeDays > 30) {
          errors.push('Late fee days must be between 1 and 30');
        } else {
          validatedData.lateFeeDays = lateFeeDays;
        }
      }
    }

    if (data.petDeposit !== undefined && data.petDeposit !== null && data.petDeposit !== '') {
      const petDeposit = parseFloat(data.petDeposit);
      if (isNaN(petDeposit) || petDeposit < 0) {
        errors.push('Pet deposit must be 0 or greater');
      } else {
        validatedData.petDeposit = petDeposit;
      }
    }

    if (data.autoRenewal !== undefined) {
      validatedData.autoRenewal = data.autoRenewal === true || data.autoRenewal === 'true';
    }

    if (data.renewalNotice !== undefined && data.renewalNotice !== null) {
      const renewalNotice = parseInt(data.renewalNotice);
      if (isNaN(renewalNotice) || renewalNotice < 1 || renewalNotice > 365) {
        errors.push('Renewal notice must be between 1 and 365 days');
      } else {
        validatedData.renewalNotice = renewalNotice;
      }
    }

    if (data.terminationNotice !== undefined && data.terminationNotice !== null) {
      const terminationNotice = parseInt(data.terminationNotice);
      if (isNaN(terminationNotice) || terminationNotice < 1 || terminationNotice > 365) {
        errors.push('Termination notice must be between 1 and 365 days');
      } else {
        validatedData.terminationNotice = terminationNotice;
      }
    }

    if (data.earlyTerminationFee !== undefined && data.earlyTerminationFee !== null && data.earlyTerminationFee !== '') {
      const earlyTerminationFee = parseFloat(data.earlyTerminationFee);
      if (isNaN(earlyTerminationFee) || earlyTerminationFee < 0) {
        errors.push('Early termination fee must be 0 or greater');
      } else {
        validatedData.earlyTerminationFee = earlyTerminationFee;
      }
    }

    if (data.signedAt !== undefined) {
      if (data.signedAt) {
        // Keep as string to let formatDateForStorage handle UTC conversion
        if (typeof data.signedAt === 'string') {
          validatedData.signedAt = data.signedAt;
        } else if (data.signedAt instanceof Date) {
          // If already a Date, convert to string first
          const year = data.signedAt.getUTCFullYear();
          const month = String(data.signedAt.getUTCMonth() + 1).padStart(2, '0');
          const day = String(data.signedAt.getUTCDate()).padStart(2, '0');
          validatedData.signedAt = `${year}-${month}-${day}`;
        } else {
          errors.push('Invalid signed at date');
        }
      } else {
        validatedData.signedAt = null;
      }
    }

    if (data.witnessName !== undefined) {
      validatedData.witnessName = data.witnessName ? (typeof data.witnessName === 'string' ? data.witnessName.trim() : String(data.witnessName)) : null;
    }

    if (data.notes !== undefined) {
      validatedData.notes = data.notes ? (typeof data.notes === 'string' ? data.notes.trim() : String(data.notes)) : null;
    }

    if (data.platformCommissionOverride !== undefined) {
      validatedData.platformCommissionOverride = data.platformCommissionOverride === true || data.platformCommissionOverride === 'true';
    }

    if (data.platformCommissionOverride) {
      if (data.platformCommissionType !== undefined) {
        const validTypes = ['PERCENTAGE', 'FIXED'];
        if (data.platformCommissionType && !validTypes.includes(data.platformCommissionType)) {
          errors.push(`Platform commission type must be one of: ${validTypes.join(', ')}`);
        } else {
          validatedData.platformCommissionType = data.platformCommissionType || null;
        }
      }

      if (data.platformCommissionRate !== undefined && data.platformCommissionRate !== null && data.platformCommissionRate !== '') {
        const rate = parseFloat(data.platformCommissionRate);
        if (isNaN(rate) || rate < 0 || rate > 100) {
          errors.push('Platform commission rate must be between 0 and 100');
        } else {
          validatedData.platformCommissionRate = rate;
        }
      }

      if (data.platformCommissionFixed !== undefined && data.platformCommissionFixed !== null && data.platformCommissionFixed !== '') {
        const fixed = parseFloat(data.platformCommissionFixed);
        if (isNaN(fixed) || fixed < 0) {
          errors.push('Platform commission fixed amount must be 0 or greater');
        } else {
          validatedData.platformCommissionFixed = fixed;
        }
      }
    }

    if (data.agencyCommissionEnabled !== undefined) {
      validatedData.agencyCommissionEnabled = data.agencyCommissionEnabled === true || data.agencyCommissionEnabled === 'true';
    }

    if (data.agencyCommissionEnabled) {
      if (data.agencyCommissionType !== undefined) {
        const validTypes = ['PERCENTAGE', 'FIXED'];
        if (data.agencyCommissionType && !validTypes.includes(data.agencyCommissionType)) {
          errors.push(`Agency commission type must be one of: ${validTypes.join(', ')}`);
        } else {
          validatedData.agencyCommissionType = data.agencyCommissionType || null;
        }
      }

      if (data.agencyCommissionRate !== undefined && data.agencyCommissionRate !== null && data.agencyCommissionRate !== '') {
        const rate = parseFloat(data.agencyCommissionRate);
        if (isNaN(rate) || rate < 0 || rate > 100) {
          errors.push('Agency commission rate must be between 0 and 100');
        } else {
          validatedData.agencyCommissionRate = rate;
        }
      }

      if (data.agencyCommissionFixed !== undefined && data.agencyCommissionFixed !== null && data.agencyCommissionFixed !== '') {
        const fixed = parseFloat(data.agencyCommissionFixed);
        if (isNaN(fixed) || fixed < 0) {
          errors.push('Agency commission fixed amount must be 0 or greater');
        } else {
          validatedData.agencyCommissionFixed = fixed;
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
      data: validatedData,
    };
  }
}

module.exports = LeaseDTO;

