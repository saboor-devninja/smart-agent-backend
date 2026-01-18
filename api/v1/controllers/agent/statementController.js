const StatementService = require("../../services/statementService");
const tryCatchAsync = require("../../../../utils/tryCatchAsync");
const apiResponse = require("../../../../utils/apiResponse");
const { success } = require("../../../../utils/statusCode").statusCode;

exports.getCombinedStatements = tryCatchAsync(async (req, res, next) => {
  const filters = {
    status: req.query.status || "all",
    startDate: req.query.startDate || "",
    endDate: req.query.endDate || "",
  };

  const result = await StatementService.getCombinedStatements(req.user._id, filters);

  return apiResponse.successResponse(
    res,
    result,
    "Combined statements retrieved successfully",
    success
  );
});

exports.getStatementDetails = tryCatchAsync(async (req, res, next) => {
  const { type, id } = req.params;
  const filters = {
    status: req.query.status || "all",
    startDate: req.query.startDate || "",
    endDate: req.query.endDate || "",
  };

  const result = await StatementService.getStatementDetails(req.user._id, type, id, filters);

  return apiResponse.successResponse(
    res,
    result,
    "Statement details retrieved successfully",
    success
  );
});

exports.getGenericStatement = tryCatchAsync(async (req, res, next) => {
  const filters = {
    status: req.query.status || "all",
    startDate: req.query.startDate || "",
    endDate: req.query.endDate || "",
  };

  const result = await StatementService.getGenericStatement(req.user._id, filters);

  return apiResponse.successResponse(
    res,
    result,
    "Generic statement retrieved successfully",
    success
  );
});

