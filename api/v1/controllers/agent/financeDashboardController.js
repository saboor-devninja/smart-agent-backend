const FinanceDashboardService = require("../../services/financeDashboardService");
const tryCatchAsync = require("../../../../utils/tryCatchAsync");
const apiResponse = require("../../../../utils/apiResponse");
const { success } = require("../../../../utils/statusCode").statusCode;

exports.getDashboard = tryCatchAsync(async (req, res, next) => {
  const result = await FinanceDashboardService.getDashboard(req.user._id);

  return apiResponse.successResponse(
    res,
    result,
    "Finance dashboard data retrieved successfully",
    success
  );
});


