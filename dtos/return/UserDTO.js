class UserDTO {
  static setDTO(user) {
    const newUser = {};
    newUser._id = user._id;
    newUser.email = user.email;
    newUser.firstName = user.firstName;
    newUser.lastName = user.lastName;
    newUser.role = user.role;
    newUser.agencyId = user.agencyId || null;
    newUser.isIndependent = user.isIndependent || false;
    newUser.currency = user.currency || "USD";
    newUser.currencySymbol = user.currencySymbol || "$";
    newUser.currencyLocale = user.currencyLocale || "en-US";
    newUser.emailVerified = user.emailVerified || false;
    newUser.isActive = user.isActive !== undefined ? user.isActive : true;
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

