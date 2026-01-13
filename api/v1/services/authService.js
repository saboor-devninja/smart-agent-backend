const User = require("../../../models/User");
const AppError = require("../../../utils/appError");
const { signToken } = require("../../../utils/jwt");

class AuthService {
  static async signup(data) {
    const { email, password, firstName, lastName, role, agencyId, isIndependent } = data;

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new AppError('Email already exists', 400);
    }

    const user = await User.create({
      email: email.toLowerCase(),
      password,
      firstName,
      lastName,
      role: role || 'AGENT',
      agencyId: agencyId || null,
      isIndependent: isIndependent || false,
    });

    user.password = undefined;

    const token = signToken(user._id, user.role);

    return {
      user,
      token,
    };
  }

  static async login(email, password) {
    if (!email || !password) {
      throw new AppError('Please provide email and password', 400);
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      throw new AppError('Incorrect email or password', 401);
    }

    if (!user.isActive) {
      throw new AppError('Your account has been deactivated', 401);
    }

    user.password = undefined;

    const token = signToken(user._id, user.role);

    return {
      user,
      token,
    };
  }

  static async getCurrentUser(userId) {
    const user = await User.findById(userId);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return user;
  }

  static async resetPassword(email, otp, newPassword) {
    const OtpVerification = require("../../../models/OtpVerification");
    const { cleanOTPInput } = require("../../../utils/otp");

    const otpRecord = await OtpVerification.findOne({
      email: email.toLowerCase(),
      type: "PASSWORD_RESET",
    });

    if (!otpRecord) {
      throw new AppError("Verification code not found. Please request a new one.", 400);
    }

    if (!otpRecord.verified) {
      throw new AppError("Please verify the OTP first.", 400);
    }

    const cleanedOtp = cleanOTPInput(otp);

    if (otpRecord.otp !== cleanedOtp) {
      throw new AppError("Invalid verification code.", 400);
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      throw new AppError("User not found.", 404);
    }

    user.password = newPassword;
    await user.save();

    await OtpVerification.deleteMany({
      email: email.toLowerCase(),
      type: "PASSWORD_RESET",
    });

    user.password = undefined;

    return { user, message: "Password reset successfully!" };
  }
}

module.exports = AuthService;

