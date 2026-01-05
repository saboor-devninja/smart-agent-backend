class SignupDTO {
  static validate(data) {
    const errors = [];
    
    if (!data.email) {
      errors.push("Email is required");
    } else if (!/^\S+@\S+\.\S+$/.test(data.email)) {
      errors.push("Please provide a valid email");
    }
    
    if (!data.password) {
      errors.push("Password is required");
    } else if (data.password.length < 6) {
      errors.push("Password must be at least 6 characters");
    }
    
    if (!data.firstName) {
      errors.push("First name is required");
    }
    
    if (!data.lastName) {
      errors.push("Last name is required");
    }
    
    if (data.role && !["PLATFORM_ADMIN", "AGENCY_ADMIN", "MODERATOR", "AGENT"].includes(data.role)) {
      errors.push("Invalid role");
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors,
      data: {
        email: data.email?.toLowerCase().trim(),
        password: data.password,
        firstName: data.firstName?.trim(),
        lastName: data.lastName?.trim(),
        role: data.role || "AGENT",
        agencyId: data.agencyId || null,
        isIndependent: data.isIndependent || false,
      },
    };
  }
}

module.exports = SignupDTO;

