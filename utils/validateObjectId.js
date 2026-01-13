const mongoose = require("mongoose");
const AppError = require("./appError");
const { badRequest } = require("./statusCode").statusCode;

/**
 * Validates if a string is a valid MongoDB ObjectId
 * @param {string} id - The ID to validate
 * @param {string} fieldName - Name of the field for error message (default: "ID")
 * @returns {boolean} - True if valid
 * @throws {AppError} - If invalid
 */
const validateObjectId = (id, fieldName = "ID") => {
  if (!id) {
    throw new AppError(`${fieldName} is required`, badRequest);
  }

  if (typeof id !== "string") {
    throw new AppError(`${fieldName} must be a string`, badRequest);
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${fieldName} format`, badRequest);
  }

  return true;
};

/**
 * Middleware to validate req.params.id
 */
const validateParamId = (req, res, next) => {
  try {
    validateObjectId(req.params.id, "ID");
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  validateObjectId,
  validateParamId,
};
