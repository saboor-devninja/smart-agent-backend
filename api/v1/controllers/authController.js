const AuthService = require("../services/authService");
const tryCatchAsync = require("../../../utils/tryCatchAsync");
const apiResponse = require("../../../utils/apiResponse");
const AppError = require("../../../utils/appError");
const { created, success, badRequest } = require("../../../utils/statusCode").statusCode;
const SignupDTO = require("../../../dtos/add/SignupDTO");
const LoginDTO = require("../../../dtos/add/LoginDTO");
const UserDTO = require("../../../dtos/return/UserDTO");

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

  const responseData = UserDTO.setDTOWithToken(user, token);

  apiResponse.successResponse(
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

