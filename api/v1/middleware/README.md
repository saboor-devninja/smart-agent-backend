# Authorization Middleware

This directory contains middleware for handling authentication and authorization.

## Files

- **`auth.js`**: Authentication middleware (JWT verification, user loading)
- **`authorize.js`**: Authorization middleware (role-based access control, resource ownership)

## Usage Examples

### 1. Restrict Route to Specific Roles

```javascript
const { protect } = require("../middleware/auth");
const { restrictTo } = require("../middleware/authorize");

// Only platform admins can access
router.get("/admin-only", protect, restrictTo('PLATFORM_ADMIN'), getAdminData);

// Platform admins and agency admins can access
router.get("/admin", protect, restrictTo('PLATFORM_ADMIN', 'AGENCY_ADMIN'), getAdminData);

// All authenticated users (no role restriction)
router.get("/all", protect, restrictTo(), getAllData);
// OR simply:
router.get("/all", protect, getAllData);
```

### 2. Check Resource Ownership

```javascript
const { protect } = require("../middleware/auth");
const { checkResourceOwnership } = require("../middleware/authorize");
const Property = require("../../../models/Property");

// Automatically checks if user owns the property
router.get(
  "/:id",
  protect,
  checkResourceOwnership({
    fetchResource: async (id) => await Property.findById(id),
    agentIdField: 'agentId',
    agencyIdField: 'agencyId',
  }),
  getProperty
);
```

### 3. Combined Usage

```javascript
// Restrict to specific roles AND check ownership
router.patch(
  "/:id",
  protect,
  restrictTo('PLATFORM_ADMIN', 'AGENCY_ADMIN', 'AGENT'),
  checkResourceOwnership({
    fetchResource: async (id) => await Property.findById(id),
  }),
  updateProperty
);
```

## How It Works

### `restrictTo(...roles)`
- Checks if user's role is in the allowed roles list
- If no roles specified, allows all authenticated users
- Platform admins can be given special access by including 'PLATFORM_ADMIN' in the roles list

### `checkResourceOwnership(options)`
- Fetches the resource using the provided `fetchResource` function
- Checks ownership based on:
  - **Platform Admin**: Access to all resources
  - **Agency Admin**: Access to resources in their agency (`agencyId` match)
  - **Agent**: Access to their own resources (`agentId` match)
- Attaches the resource to `req.resource` for use in controllers
- Returns 404 if resource not found
- Returns 403 if user doesn't have permission

## Benefits

1. **Separation of Concerns**: Authorization logic is separated from business logic
2. **Reusability**: Middleware can be reused across different routes
3. **Declarative**: Routes clearly show who can access what
4. **Maintainability**: Changes to authorization logic happen in one place
5. **Clean Controllers**: Controllers focus on business logic, not authorization

