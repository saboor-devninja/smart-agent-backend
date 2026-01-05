const apiResponse = require("./apiResponse");
const AppError = require("./appError");
const { badRequest, notFound, unprocessable, unauthorized } =
  require("./statusCode").statusCode;

module.exports = (err, req, res, next) => {
  if (err.name === "CastError") err = handleCastErrorDB(err);
  if (err.code === 11000) err = handleDuplicateFieldsDB(err);
  if (err.name === "JsonWebTokenError") err = handleJWTError(err);
  if (err.name === "TokenExpiredError") err = handleJWTExpiredError(err);
  if (err.name === "ValidationError") err = handleValidationErrorDB(err);

  apiResponse.errorResponse(err, res);
};

const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, badRequest);
};

const handleDuplicateFieldsDB = (err) => {
  const value = err.errmsg ? err.errmsg.match(/(["'])(?:(?=(\\?))\2.)*?\1/)?.[0] : err.keyValue ? Object.values(err.keyValue)[0] : 'value';
  const message = `Duplicate Field Value: ${value}. Please use another value`;
  return new AppError(message, badRequest);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = errors.join(", ");
  return new AppError(message, unprocessable);
};

const handleJWTExpiredError = (err) =>
  new AppError("Login session has been expired, Login again", unauthorized);

const handleJWTError = (err) => new AppError("Unauthorized", unauthorized);

