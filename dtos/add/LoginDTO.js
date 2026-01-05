class LoginDTO {
  static validate(data) {
    const errors = [];
    
    if (!data.email) {
      errors.push("Email is required");
    }
    
    if (!data.password) {
      errors.push("Password is required");
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors,
      data: {
        email: data.email?.toLowerCase().trim(),
        password: data.password,
      },
    };
  }
}

module.exports = LoginDTO;

