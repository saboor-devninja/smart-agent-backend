class UserDTO {
  static setDTO(user) {
    const newUser = {};
    newUser._id = user._id;
    newUser.docNumber = user.docNumber || null;
    newUser.email = user.email;
    newUser.firstName = user.firstName;
    newUser.lastName = user.lastName;
    newUser.phone = user.phone || null;
    newUser.city = user.city || null;
    newUser.country = user.country || null;
    newUser.profilePicture = user.profilePicture || null;
    newUser.companyName = user.companyName || null;
    newUser.companyRegistration = user.companyRegistration || null;
    newUser.companyAddress = user.companyAddress || null;
    newUser.companyWebsite = user.companyWebsite || null;
    newUser.companyLogo = user.companyLogo || null;
    newUser.role = user.role;
    
    // Store only ID string, not populated object (null-safe)
    newUser.agencyId = (user.agencyId && typeof user.agencyId === 'object' && user.agencyId._id) ? user.agencyId._id : (user.agencyId || null);
    newUser.isIndependent = user.isIndependent || false;
    newUser.currency = user.currency || "USD";
    newUser.currencySymbol = user.currencySymbol || "$";
    newUser.currencyLocale = user.currencyLocale || "en-US";
    newUser.emailVerified = user.emailVerified || false;
    newUser.isActive = user.isActive !== undefined ? user.isActive : true;
    newUser.createdAt = user.createdAt;
    newUser.updatedAt = user.updatedAt;
    return newUser;
  }

  static setDTOWithToken(user, token) {
    const userData = this.setDTO(user);
    return {
      user: userData,
      token: token,
    };
  }
}

module.exports = UserDTO;

