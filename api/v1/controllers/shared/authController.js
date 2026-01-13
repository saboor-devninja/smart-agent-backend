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

exports.signup = tryCatchAsync(async (req, res, next) => {
  const validation = SignupDTO.validate(req.body);
  
  if (!validation.isValid) {
    return next(new AppError(validation.errors.join(", "), badRequest));
  }

  const { user, token } = await AuthService.signup(validation.data);

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
  const { email } = req.body;

  if (!email) {
    return next(new AppError("Email is required", badRequest));
  }

  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    return apiResponse.successResponse(
      res,
      {},
      "If an account exists with this email, a password reset code has been sent.",
      success
    );
  }

  try {
    await OtpService.createAndSendOTP(email.toLowerCase(), "PASSWORD_RESET");
    return apiResponse.successResponse(
      res,
      {},
      "If an account exists with this email, a password reset code has been sent.",
      success
    );
  } catch (error) {
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
