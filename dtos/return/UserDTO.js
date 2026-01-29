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
    
    newUser.agencyId = (user.agencyId && typeof user.agencyId === 'object' && user.agencyId._id) ? user.agencyId._id : (user.agencyId || null);
    newUser.isIndependent = user.isIndependent || false;
    const userCurrency = user.currency ? (typeof user.currency === 'string' ? user.currency.trim().toUpperCase() : user.currency) : "USD";
    
    let currencyInfo = null;
    try {
      const currencySymbolMap = {
        'ZAR': 'R', 'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥', 'CNY': '¥',
        'INR': '₹', 'CAD': '$', 'AUD': '$', 'CHF': 'CHF', 'SEK': 'kr', 'NZD': '$',
        'MXN': '$', 'SGD': '$', 'HKD': '$', 'NOK': 'kr', 'KRW': '₩', 'BRL': 'R$',
        'AED': 'د.إ', 'SAR': '﷼', 'PKR': '₨', 'TRY': '₺', 'THB': '฿'
      };
      const currencyLocaleMap = {
        'ZAR': 'en-ZA', 'USD': 'en-US', 'EUR': 'de-DE', 'GBP': 'en-GB', 'JPY': 'ja-JP',
        'CNY': 'zh-CN', 'INR': 'en-IN', 'CAD': 'en-CA', 'AUD': 'en-AU', 'CHF': 'de-CH',
        'SEK': 'sv-SE', 'NZD': 'en-NZ', 'MXN': 'es-MX', 'SGD': 'en-SG', 'HKD': 'zh-HK',
        'NOK': 'nb-NO', 'KRW': 'ko-KR', 'BRL': 'pt-BR', 'AED': 'ar-AE', 'SAR': 'ar-SA',
        'PKR': 'ur-PK', 'TRY': 'tr-TR', 'THB': 'th-TH'
      };
      
      currencyInfo = {
        symbol: currencySymbolMap[userCurrency] || '$',
        locale: currencyLocaleMap[userCurrency] || 'en-US'
      };
    } catch (e) {
      currencyInfo = { symbol: '$', locale: 'en-US' };
    }
    
    newUser.currency = userCurrency;
    newUser.currencySymbol = user.currencySymbol ? (typeof user.currencySymbol === 'string' ? user.currencySymbol.trim() : user.currencySymbol) : currencyInfo.symbol;
    newUser.currencyLocale = user.currencyLocale ? (typeof user.currencyLocale === 'string' ? user.currencyLocale.trim() : user.currencyLocale) : currencyInfo.locale;
    newUser.currencySet = user.currencySet || false;
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

