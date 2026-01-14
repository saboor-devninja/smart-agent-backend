const User = require("../../../models/User");
const Agency = require("../../../models/Agency");
const AppError = require("../../../utils/appError");
const { signToken } = require("../../../utils/jwt");
const mongoose = require("mongoose");

class AuthService {
  static async signup(data) {
    const {
      email,
      password,
      firstName,
      lastName,
      role,
      agencyId,
      isIndependent,
      phone,
      city,
      country,
      companyName,
      companyRegistration,
      companyAddress,
      companyWebsite,
      profilePicture,
      companyLogo,
    } = data;

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new AppError("Email already exists", 400);
    }

    // Create user and mark email as verified (no OTP flow)
    const user = await User.create({
      email: email.toLowerCase(),
      password,
      firstName,
      lastName,
      role: role || "AGENT",
      agencyId: agencyId || null,
      isIndependent: isIndependent || false,
      phone: phone || null,
      city: city || null,
      country: country || null,
      companyName: companyName || null,
      companyRegistration: companyRegistration || null,
      companyAddress: companyAddress || null,
      companyWebsite: companyWebsite || null,
      companyLogo: companyLogo || null,
      profilePicture: profilePicture || null,
      emailVerified: true,
      emailVerifiedAt: new Date(),
    });

    user.password = undefined;

    // Return token so user can log in immediately
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

  static async signupAgency(data) {
    const {
      agencyInfo,
      agencyAdmin,
      password,
      profilePicture,
      agencyLogo,
    } = data;

    // Check if agency email already exists
    const existingAgency = await Agency.findOne({
      email: agencyInfo.agencyEmail.toLowerCase(),
    });

    if (existingAgency) {
      throw new AppError("An agency with this email already exists", 400);
    }

    // Check if admin user email already exists
    const existingUser = await User.findOne({
      email: agencyAdmin.email.toLowerCase(),
    });

    if (existingUser) {
      throw new AppError("A user with this email already exists", 400);
    }

    // Create agency and admin user in a transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Create Agency
      const agency = await Agency.create(
        [
          {
            name: agencyInfo.agencyName,
            email: agencyInfo.agencyEmail.toLowerCase(),
            phone: agencyInfo.agencyPhone || null,
            registrationNumber: agencyInfo.agencyRegistrationNumber || null,
            address: agencyInfo.agencyAddress || null,
            city: agencyInfo.agencyCity || null,
            country: agencyInfo.agencyCountry || null,
            postalCode: agencyInfo.agencyPostalCode || null,
            website: agencyInfo.agencyWebsite || null,
            logo: agencyLogo || null,
            status: "ACTIVE",
            emailVerified: true,
            emailVerifiedAt: new Date(),
          },
        ],
        { session }
      );

      const createdAgency = Array.isArray(agency) ? agency[0] : agency;

      // 2. Create Agency Admin User linked to the agency
      const user = await User.create(
        [
          {
            firstName: agencyAdmin.firstName,
            lastName: agencyAdmin.lastName,
            email: agencyAdmin.email.toLowerCase(),
            phone: agencyAdmin.phone,
            city: agencyAdmin.city,
            country: agencyAdmin.country,
            password: password,
            role: "AGENCY_ADMIN",
            isIndependent: false,
            agencyId: createdAgency._id,
            profilePicture: profilePicture || null,
            emailVerified: true,
            emailVerifiedAt: new Date(),
          },
        ],
        { session }
      );

      const createdUser = Array.isArray(user) ? user[0] : user;

      await session.commitTransaction();
      session.endSession();

      createdUser.password = undefined;

      return {
        agency: createdAgency,
        user: createdUser,
      };
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }
}

module.exports = AuthService;

