const tryCatchAsync = require("../../../../utils/tryCatchAsync");
const apiResponse = require("../../../../utils/apiResponse");
const { success } = require("../../../../utils/statusCode").statusCode;
const AppError = require("../../../../utils/appError");
const User = require("../../../../models/User");
const Agency = require("../../../../models/Agency");

/**
 * GET /api/v1/admin/users
 * Get all users in the system (only for PLATFORM_ADMIN)
 */
exports.getAllUsers = tryCatchAsync(async (req, res, next) => {
  if (req.user.role !== 'PLATFORM_ADMIN') {
    return next(new AppError('Only platform admins can access this endpoint', 403));
  }

  // Get query parameters for filtering and pagination
  const {
    role,
    isActive,
    search,
    page = 1,
    limit = 100,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = req.query;

  // Build filter object
  const filter = {};

  // By default, admin "Users" list should show only agents and agency admins
  // (platform admins / moderators are managed separately).
  // Allow overriding via ?role= if needed.
  if (role) {
    filter.role = role;
  } else {
    filter.role = { $in: ["AGENT", "AGENCY_ADMIN"] };
  }
  
  if (isActive !== undefined) {
    filter.isActive = isActive === 'true';
  }
  
  if (search) {
    filter.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  // Calculate pagination
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  // Build sort object
  const sort = {};
  sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

  // Fetch users with pagination
  const [users, total] = await Promise.all([
    User.find(filter)
      .select('-password') // Exclude password
      .populate('agencyId', 'name')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    User.countDocuments(filter),
  ]);

  // Transform users to include agency name
  const transformedUsers = users.map(user => ({
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    city: user.city,
    country: user.country,
    profilePicture: user.profilePicture,
    role: user.role,
    isActive: user.isActive,
    isIndependent: user.isIndependent,
    agencyId: user.agencyId?._id || user.agencyId || null,
    agencyName: user.agencyId?.name || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }));

  apiResponse.successResponse(
    res,
    {
      users: transformedUsers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    },
    "Users retrieved successfully",
    success
  );
});
