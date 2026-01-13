/**
 * Generate a 6-digit OTP
 */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Get OTP expiry time (15 minutes from now)
 */
function getOTPExpiryTime() {
  const expiryMinutes = 15;
  const expiryTime = new Date();
  expiryTime.setMinutes(expiryTime.getMinutes() + expiryMinutes);
  return expiryTime;
}

/**
 * Check if OTP is expired
 */
function isOTPExpired(expiresAt) {
  return new Date() > new Date(expiresAt);
}

/**
 * Clean OTP input (remove spaces, dashes, etc.)
 */
function cleanOTPInput(input) {
  if (!input) return "";
  return input.toString().replace(/\s|-/g, "");
}

module.exports = {
  generateOTP,
  getOTPExpiryTime,
  isOTPExpired,
  cleanOTPInput,
};
