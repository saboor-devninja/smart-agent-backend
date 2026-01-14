const AgentService = require("../../services/agentService");
const tryCatchAsync = require("../../../../utils/tryCatchAsync");
const apiResponse = require("../../../../utils/apiResponse");
const AppError = require("../../../../utils/appError");
const { success, created, badRequest } = require("../../../../utils/statusCode").statusCode;
const { restrictTo } = require("../../middleware/authorize");
const { validateObjectId } = require("../../../../utils/validateObjectId");

/**
 * Get all agents in the agency
 * Only accessible by AGENCY_ADMIN
 */
exports.getAgencyAgents = tryCatchAsync(async (req, res, next) => {
  if (req.user.role !== "AGENCY_ADMIN" || !req.user.agencyId) {
    return next(new AppError("Only agency admins can access this resource", 403));
  }

  const agents = await AgentService.getAgencyAgents(req.user.agencyId);

  return apiResponse.successResponse(
    res,
    { agents },
    "Agents retrieved successfully",
    success
  );
});

/**
 * Create a new agent for the agency
 * Only accessible by AGENCY_ADMIN
 */
exports.createAgent = tryCatchAsync(async (req, res, next) => {
  if (req.user.role !== "AGENCY_ADMIN" || !req.user.agencyId) {
    return next(new AppError("Only agency admins can create agents", 403));
  }

  const { email, password, firstName, lastName, phone, city, country } = req.body;

  if (!email || !password || !firstName || !lastName) {
    return next(new AppError("Email, password, first name, and last name are required", badRequest));
  }

  if (password.length < 6) {
    return next(new AppError("Password must be at least 6 characters long", badRequest));
  }

  const agent = await AgentService.createAgent(
    { email, password, firstName, lastName, phone, city, country },
    req.user.agencyId
  );

  return apiResponse.successResponse(
    res,
    { agent },
    "Agent created successfully",
    created
  );
});

/**
 * Get agent details with statistics
 * Only accessible by AGENCY_ADMIN
 */
exports.getAgentDetail = tryCatchAsync(async (req, res, next) => {
  if (req.user.role !== "AGENCY_ADMIN" || !req.user.agencyId) {
    return next(new AppError("Only agency admins can access this resource", 403));
  }

  const { id } = req.params;

  validateObjectId(id, "Agent ID");

  const result = await AgentService.getAgentDetail(id, req.user.agencyId);

  return apiResponse.successResponse(
    res,
    result,
    "Agent details retrieved successfully",
    success
  );
});

/**
 * Update agent information
 * Only accessible by AGENCY_ADMIN
 */
exports.updateAgent = tryCatchAsync(async (req, res, next) => {
  if (req.user.role !== "AGENCY_ADMIN" || !req.user.agencyId) {
    return next(new AppError("Only agency admins can update agents", 403));
  }

  const { id } = req.params;

  validateObjectId(id, "Agent ID");

  const agent = await AgentService.updateAgent(id, req.body, req.user.agencyId);

  return apiResponse.successResponse(
    res,
    { agent },
    "Agent updated successfully",
    success
  );
});

/**
 * Delete agent (soft delete)
 * Only accessible by AGENCY_ADMIN
 */
exports.deleteAgent = tryCatchAsync(async (req, res, next) => {
  if (req.user.role !== "AGENCY_ADMIN" || !req.user.agencyId) {
    return next(new AppError("Only agency admins can delete agents", 403));
  }

  const { id } = req.params;

  validateObjectId(id, "Agent ID");

  const agent = await AgentService.deleteAgent(id, req.user.agencyId);

  return apiResponse.successResponse(
    res,
    { agent },
    "Agent deleted successfully",
    success
  );
});
