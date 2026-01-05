const AppError = require("../../../utils/appError");
const tryCatchAsync = require("../../../utils/tryCatchAsync");

/**
 * Restrict route access to specific roles
 * @param {...string} roles - Allowed roles (e.g., 'PLATFORM_ADMIN', 'AGENCY_ADMIN', 'AGENT')
 * @returns {Function} Express middleware
 * 
 * Usage:
 * router.get('/', protect, restrictTo('PLATFORM_ADMIN', 'AGENCY_ADMIN'), getItems);
 * router.get('/', protect, restrictTo(), getItems); // All authenticated users
 */
exports.restrictTo = (...roles) => {
  return tryCatchAsync(async (req, res, next) => {
    if (!req.user) {
      return next(new AppError('You are not logged in. Please log in to get access.', 401));
    }

    // If no roles specified, allow all authenticated users
    if (roles.length === 0) {
      return next();
    }

    // Check if user's role is in the allowed roles
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError(
          'You do not have permission to perform this action',
          403
        )
      );
    }

    next();
  });
};

/**
 * Check if user owns or has access to a resource
 * This middleware should be used after fetching the resource and attaching it to req.resource
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.resourceIdParam - Request param name containing resource ID (default: 'id')
 * @param {Function} options.fetchResource - Function to fetch resource: async (resourceId) => resource
 * @param {string} options.agentIdField - Field name in resource for agentId (default: 'agentId')
 * @param {string} options.agencyIdField - Field name in resource for agencyId (default: 'agencyId')
 * @param {string} options.errorMessage - Custom error message (default: 'You do not have permission to access this resource')
 * @returns {Function} Express middleware
 * 
 * Usage:
 * router.get('/:id', 
 *   protect, 
 *   checkResourceOwnership({
 *     fetchResource: async (id) => await Property.findById(id),
 *     agentIdField: 'agentId',
 *     agencyIdField: 'agencyId'
 *   }),
 *   getProperty
 * );
 */
exports.checkResourceOwnership = (options = {}) => {
  const {
    resourceIdParam = 'id',
    fetchResource,
    agentIdField = 'agentId',
    agencyIdField = 'agencyId',
    errorMessage = 'You do not have permission to access this resource',
  } = options;

  if (!fetchResource || typeof fetchResource !== 'function') {
    throw new Error('fetchResource function is required');
  }

  return tryCatchAsync(async (req, res, next) => {
    if (!req.user) {
      return next(new AppError('You are not logged in. Please log in to get access.', 401));
    }

    const resourceId = req.params[resourceIdParam];
    if (!resourceId) {
      return next(new AppError('Resource ID is required', 400));
    }

    const resource = await fetchResource(resourceId);
    
    if (!resource) {
      return next(new AppError('Resource not found', 404));
    }

    // Platform admin has access to everything
    if (req.user.role === 'PLATFORM_ADMIN') {
      req.resource = resource;
      return next();
    }

    // Agency admin can access resources in their agency
    if (req.user.role === 'AGENCY_ADMIN') {
      const resourceAgencyId = resource[agencyIdField]?.toString() || resource[agencyIdField];
      const userAgencyId = req.user.agencyId?.toString() || req.user.agencyId;
      
      if (resourceAgencyId && userAgencyId && resourceAgencyId === userAgencyId) {
        req.resource = resource;
        return next();
      }
      
      return next(new AppError(errorMessage, 403));
    }

    // Regular agent can only access their own resources
    const resourceAgentId = resource[agentIdField]?.toString() || resource[agentIdField];
    const userId = req.user._id?.toString() || req.user._id;
    
    if (resourceAgentId && userId && resourceAgentId === userId) {
      req.resource = resource;
      return next();
    }

    return next(new AppError(errorMessage, 403));
  });
};

/**
 * Check if user can access a resource by landlord ownership
 * Special case: checks if user owns the landlord, then allows access to landlord's resources
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.resourceIdParam - Request param name containing resource ID (default: 'id')
 * @param {Function} options.fetchResource - Function to fetch resource: async (resourceId) => resource
 * @param {string} options.landlordIdField - Field name in resource for landlordId (default: 'landlordId')
 * @returns {Function} Express middleware
 */
exports.checkResourceByLandlord = (options = {}) => {
  const {
    resourceIdParam = 'id',
    fetchResource,
    landlordIdField = 'landlordId',
  } = options;

  if (!fetchResource || typeof fetchResource !== 'function') {
    throw new Error('fetchResource function is required');
  }

  return tryCatchAsync(async (req, res, next) => {
    if (!req.user) {
      return next(new AppError('You are not logged in. Please log in to get access.', 401));
    }

    const resourceId = req.params[resourceIdParam];
    if (!resourceId) {
      return next(new AppError('Resource ID is required', 400));
    }

    const resource = await fetchResource(resourceId);
    
    if (!resource) {
      return next(new AppError('Resource not found', 404));
    }

    // Platform admin has access to everything
    if (req.user.role === 'PLATFORM_ADMIN') {
      req.resource = resource;
      return next();
    }

    const Landlord = require("../../../models/Landlord");
    const landlordId = resource[landlordIdField]?.toString() || resource[landlordIdField];
    
    if (!landlordId) {
      return next(new AppError('Resource does not have an associated landlord', 400));
    }

    const landlord = await Landlord.findById(landlordId);
    if (!landlord) {
      return next(new AppError('Associated landlord not found', 404));
    }

    // Agency admin can access if landlord belongs to their agency
    if (req.user.role === 'AGENCY_ADMIN') {
      const landlordAgencyId = landlord.agencyId?.toString() || landlord.agencyId;
      const userAgencyId = req.user.agencyId?.toString() || req.user.agencyId;
      
      if (landlordAgencyId && userAgencyId && landlordAgencyId === userAgencyId) {
        req.resource = resource;
        return next();
      }
      
      return next(new AppError('You do not have permission to access this resource', 403));
    }

    // Regular agent can access if they own the landlord
    const landlordAgentId = landlord.agentId?.toString() || landlord.agentId;
    const userId = req.user._id?.toString() || req.user._id;
    
    if (landlordAgentId && userId && landlordAgentId === userId) {
      req.resource = resource;
      return next();
    }

    return next(new AppError('You do not have permission to access this resource', 403));
  });
};

