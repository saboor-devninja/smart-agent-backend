const AuthService = require("../../services/authService");
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

/**
 * DEV/SETUP ONLY: Create initial PLATFORM_ADMIN user
 * 
 * Email: admin.dev@smartagent.digit
 * Password: test@123
 * 
 * This route is intentionally left unauthenticated so you can hit it once
 * in a fresh environment, then comment/remove it before going live.
 */
exports.createPlatformAdminDev = tryCatchAsync(async (req, res, next) => {
  // Check if a platform admin already exists
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
