const AuthService = require("../../services/authService");
const OtpService = require("../../services/otpService");
const tryCatchAsync = require("../../../../utils/tryCatchAsync");
const apiResponse = require("../../../../utils/apiResponse");
const AppError = require("../../../../utils/appError");
const { created, success, badRequest } = require("../../../../utils/statusCode").statusCode;
const SignupDTO = require("../../../../dtos/add/SignupDTO");
const LoginDTO = require("../../../../dtos/add/LoginDTO");
const UserDTO = require("../../../../dtos/return/UserDTO");
const User = require("../../../../models/User");
const Agency = require("../../../../models/Agency");

exports.signup = tryCatchAsync(async (req, res, next) => {
  const validation = SignupDTO.validate(req.body);
  
  if (!validation.isValid) {
    return next(new AppError(validation.errors.join(", "), badRequest));
  }

  // Extract additional fields that might be in the request
  const signupData = {
    ...validation.data,
    phone: req.body.phone || null,
    city: req.body.city || null,
    country: req.body.country || null,
    companyName: req.body.companyName || null,
    companyRegistration: req.body.companyRegistration || null,
    companyAddress: req.body.companyAddress || null,
    companyWebsite: req.body.companyWebsite || null,
    profilePicture: req.body.profilePicture || null,
    companyLogo: req.body.companyLogo || null,
  };

  const { user, token } = await AuthService.signup(signupData);

  const responseData = UserDTO.setDTOWithToken(user, token);

  apiResponse.successResponse(
    res,
    responseData,
    "User created successfully",
    created
  );
});

exports.login = tryCatchAsync(async (req, res, next) => {
  const validation = LoginDTO.validate(req.body);
  
  if (!validation.isValid) {
    return next(new AppError(validation.errors.join(", "), badRequest));
  }

  const { user, token } = await AuthService.login(validation.data.email, validation.data.password);

  if (!user || !token) {
    return next(new AppError("Login failed: missing user or token", 500));
  }

  const responseData = UserDTO.setDTOWithToken(user, token);

  return apiResponse.successResponse(
    res,
    responseData,
    "Login successful",
    success
  );
});

exports.getMe = tryCatchAsync(async (req, res, next) => {
  const user = await AuthService.getCurrentUser(req.user._id);

  const userData = UserDTO.setDTO(user);

  apiResponse.successResponse(
    res,
    { user: userData },
    "User retrieved successfully",
    success
  );
});

exports.createPlatformAdminDev = tryCatchAsync(async (req, res, next) => {
  const existingAdmin = await User.findOne({ role: "PLATFORM_ADMIN" }).lean();
  if (existingAdmin) {
    return next(new AppError("Platform admin already exists", badRequest));
  }

  const signupPayload = {
    email: "admin.dev@smartagent.digit",
    password: "test@123",
    firstName: "Platform",
    lastName: "Admin",
    role: "PLATFORM_ADMIN",
    isIndependent: false,
    agencyId: null,
  };

  const validation = SignupDTO.validate(signupPayload);

  if (!validation.isValid) {
    return next(new AppError(validation.errors.join(", "), badRequest));
  }

  const { user, token } = await AuthService.signup(validation.data);
  const responseData = UserDTO.setDTOWithToken(user, token);

  apiResponse.successResponse(
    res,
    responseData,
    "Platform admin user created successfully (DEV route)",
    created
  );
});

exports.forgotPassword = tryCatchAsync(async (req, res, next) => {
  console.log("[forgotPassword] Request received:", { email: req.body.email });
  
  const { email } = req.body;

  if (!email) {
    console.log("[forgotPassword] Email missing in request");
    return next(new AppError("Email is required", badRequest));
  }

  console.log(`[forgotPassword] Looking up user with email: ${email.toLowerCase()}`);
  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    console.log(`[forgotPassword] User not found for email: ${email}`);
    return next(new AppError("No account found with this email address. Please check your email and try again.", 404));
  }

  console.log(`[forgotPassword] User found: ${user._id}, calling OtpService.createAndSendOTP`);
  try {
    const result = await OtpService.createAndSendOTP(email.toLowerCase(), "PASSWORD_RESET");
    console.log(`[forgotPassword] OTP service result:`, result);
    
    return apiResponse.successResponse(
      res,
      {},
      "Password reset code has been sent to your email address.",
      success
    );
  } catch (error) {
    console.error(`[forgotPassword] Error in OTP service:`, error);
    console.error(`[forgotPassword] Error stack:`, error.stack);
    return next(new AppError(error.message || "Failed to send password reset code", 500));
  }
});

exports.verifyPasswordResetOTP = tryCatchAsync(async (req, res, next) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return next(new AppError("Email and OTP are required", badRequest));
  }

  const result = await OtpService.verifyOTP(email.toLowerCase(), otp, "PASSWORD_RESET");

  if (!result.success) {
    return next(new AppError(result.message, badRequest));
  }

  return apiResponse.successResponse(res, {}, result.message, success);
});

exports.resetPassword = tryCatchAsync(async (req, res, next) => {
  const { email, otp, password } = req.body;

  if (!email || !otp || !password) {
    return next(new AppError("Email, OTP, and password are required", badRequest));
  }

  if (password.length < 6) {
    return next(new AppError("Password must be at least 6 characters long", badRequest));
  }

  const { user } = await AuthService.resetPassword(email.toLowerCase(), otp, password);

  const userData = UserDTO.setDTO(user);

  return apiResponse.successResponse(
    res,
    { user: userData },
    "Password reset successfully! You can now login with your new password.",
    success
  );
});

exports.verifyEmailOTP = tryCatchAsync(async (req, res, next) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return next(new AppError("Email and OTP are required", badRequest));
  }

  const result = await OtpService.verifyOTP(email.toLowerCase(), otp, "EMAIL_VERIFICATION");

  if (!result.success) {
    return next(new AppError(result.message, badRequest));
  }

  // Mark user as verified (if exists)
  const user = await User.findOne({ email: email.toLowerCase() });
  if (user) {
    user.emailVerified = true;
    user.emailVerifiedAt = new Date();
    await user.save();
  }

  // Mark agency as verified (if exists and email matches)
  const agency = await Agency.findOne({ email: email.toLowerCase() });
  if (agency) {
    agency.emailVerified = true;
    agency.emailVerifiedAt = new Date();
    await agency.save();
  }

  // Clean up OTP record
  await OtpService.deleteOTPRecords(email.toLowerCase(), "EMAIL_VERIFICATION");

  return apiResponse.successResponse(
    res,
    {},
    "Email verified successfully! You can now login.",
    success
  );
});

exports.resendEmailOTP = tryCatchAsync(async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(new AppError("Email is required", badRequest));
  }

  // Check if user exists
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return next(new AppError("User not found", 404));
  }

  // Check if already verified
  if (user.emailVerified) {
    return next(new AppError("Email is already verified", badRequest));
  }

  try {
    await OtpService.createAndSendOTP(email.toLowerCase(), "EMAIL_VERIFICATION");
    return apiResponse.successResponse(
      res,
      {},
      "Verification code has been sent to your email.",
      success
    );
  } catch (error) {
    return next(new AppError(error.message || "Failed to send verification code", 500));
  }
});

exports.signupAgency = tryCatchAsync(async (req, res, next) => {
  const {
    agencyInfo,
    agencyAdmin,
    password,
    profilePicture,
    agencyLogo,
  } = req.body;

  // Validate required fields
  if (!agencyInfo || !agencyAdmin || !password) {
    return next(
      new AppError("Agency info, admin info, and password are required", badRequest)
    );
  }

  if (!agencyInfo.agencyName || !agencyInfo.agencyEmail) {
    return next(new AppError("Agency name and email are required", badRequest));
  }

  if (
    !agencyAdmin.firstName ||
    !agencyAdmin.lastName ||
    !agencyAdmin.email ||
    !agencyAdmin.phone ||
    !agencyAdmin.city ||
    !agencyAdmin.country
  ) {
    return next(
      new AppError(
        "Admin first name, last name, email, phone, city, and country are required",
        badRequest
      )
    );
  }

  if (password.length < 6) {
    return next(new AppError("Password must be at least 6 characters long", badRequest));
  }

  const { agency, user } = await AuthService.signupAgency({
    agencyInfo,
    agencyAdmin,
    password,
    profilePicture: profilePicture || null,
    agencyLogo: agencyLogo || null,
  });

  const userData = UserDTO.setDTO(user);

  return apiResponse.successResponse(
    res,
    { agency, user: userData },
    "Agency created successfully. Please check your email for verification code.",
    created
  );
});
