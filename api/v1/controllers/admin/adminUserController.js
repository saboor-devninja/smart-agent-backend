const tryCatchAsync = require("../../../../utils/tryCatchAsync");
const apiResponse = require("../../../../utils/apiResponse");
const { success } = require("../../../../utils/statusCode").statusCode;
const AppError = require("../../../../utils/appError");
const User = require("../../../../models/User");
const Agency = require("../../../../models/Agency");
const mongoose = require("mongoose");

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
  
  // Add search filter - combine with role filter properly
  if (search) {
    const searchConditions = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
    
    // If we already have a role filter, we need to combine $or with it
    // MongoDB will AND the $or with other root-level fields
    filter.$or = searchConditions;
  }
  
  // Debug: log the filter to help troubleshoot
  console.log('[Admin Users] Filter:', JSON.stringify(filter, null, 2));

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
  
  // Debug: log results
  console.log('[Admin Users] Found users:', users.length, 'Total:', total);
  if (users.length > 0) {
    console.log('[Admin Users] Sample user roles:', users.slice(0, 3).map(u => ({ email: u.email, role: u.role })));
  }

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

/**
 * GET /api/v1/admin/agencies
 * Get all agencies for admin to select when creating users (only for PLATFORM_ADMIN)
 */
exports.getAgencies = tryCatchAsync(async (req, res, next) => {
  if (req.user.role !== 'PLATFORM_ADMIN') {
    return next(new AppError('Only platform admins can access this endpoint', 403));
  }

  const agencies = await Agency.find({ status: 'ACTIVE' })
    .select('_id name email')
    .sort({ name: 1 })
    .lean();

  apiResponse.successResponse(
    res,
    { agencies },
    "Agencies retrieved successfully",
    success
  );
});

/**
 * POST /api/v1/admin/users
 * Create a new user (agent or agency admin) - only for PLATFORM_ADMIN
 */
exports.createUser = tryCatchAsync(async (req, res, next) => {
  if (req.user.role !== 'PLATFORM_ADMIN') {
    return next(new AppError('Only platform admins can create users', 403));
  }

  let {
    firstName,
    lastName,
    email,
    password,
    phone,
    city,
    country,
    role,
    agencyId,
    isIndependent,
    agencyName,
  } = req.body;

  // Validation
  if (!firstName || !lastName || !email || !password || !role) {
    return next(
      new AppError(
        "First name, last name, email, password, and role are required",
        400
      )
    );
  }

  // Validate role
  if (!["AGENT", "AGENCY_ADMIN"].includes(role)) {
    return next(new AppError("Role must be AGENT or AGENCY_ADMIN", 400));
  }

  // For agency creation from admin panel, we behave like signup:
  // - Create a new Agency
  // - Create an AGENCY_ADMIN user linked to that agency
  if (role === "AGENCY_ADMIN") {
    if (!agencyName) {
      return next(
        new AppError("Agency name is required when creating an agency user", 400)
      );
    }
  }

  // Platform admin creates agents as independent by default.
  // Agency admins can later create agents within their own agency.
  if (role === "AGENT") {
    isIndependent = true;
    agencyId = null;
  }

  // Check if user email already exists
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    return next(new AppError("User with this email already exists", 400));
  }

  // Password will be hashed by User model's pre-save hook
  // Don't hash it manually to avoid double-hashing

  let user;

  if (role === "AGENCY_ADMIN") {
    // Create Agency + Agency Admin user in a transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Ensure agency email is unique as well
      const existingAgency = await Agency.findOne(
        { email: email.toLowerCase() },
        null,
        { session }
      );

      if (existingAgency) {
        await session.abortTransaction();
        session.endSession();
        return next(
          new AppError("An agency with this email already exists", 400)
        );
      }

      const [createdAgency] = await Agency.create(
        [
          {
            name: agencyName,
            email: email.toLowerCase(),
            phone: phone || null,
            address: null,
            city: city || null,
            country: country || null,
            status: "ACTIVE",
            emailVerified: true,
            emailVerifiedAt: new Date(),
          },
        ],
        { session }
      );

      [user] = await User.create(
        [
          {
            email: email.toLowerCase(),
            password: password, // Let User model's pre-save hook hash it
            firstName,
            lastName,
            phone: phone || null,
            city: city || null,
            country: country || null,
            role: "AGENCY_ADMIN",
            agencyId: createdAgency._id,
            isIndependent: false,
            emailVerified: true,
            emailVerifiedAt: new Date(),
            isActive: true,
          },
        ],
        { session }
      );

      await session.commitTransaction();
      session.endSession();
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw err;
    }
  } else {
    // Simple agent creation (independent)
    user = await User.create({
      email: email.toLowerCase(),
      password: password, // Let User model's pre-save hook hash it
      firstName,
      lastName,
      phone: phone || null,
      city: city || null,
      country: country || null,
      role,
      agencyId: agencyId || null,
      isIndependent: isIndependent === true || (role === "AGENT" && !agencyId),
      emailVerified: true,
      emailVerifiedAt: new Date(),
      isActive: true,
    });
  }

  // Populate agency for response
  await user.populate('agencyId', 'name');

  user.password = undefined;

  const transformedUser = {
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
  };

  apiResponse.successResponse(
    res,
    { user: transformedUser },
    "User created successfully",
    success
  );
});
