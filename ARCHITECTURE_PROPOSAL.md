# Backend Architecture Proposal: Role-Based Organization

## Current Structure (Resource-Based)
```
api/v1/
├── controllers/
│   ├── propertyController.js
│   ├── leaseController.js
│   ├── notificationController.js
│   └── adminNotificationController.js
├── routes/
│   ├── property.routes.js
│   ├── lease.routes.js
│   └── adminNotification.routes.js
└── services/
    ├── propertyService.js
    └── leaseService.js
```

## Proposed Structure (Hybrid: Role-Based + Shared Services)

### Option 1: Full Role-Based Organization
```
api/v1/
├── shared/
│   ├── services/          # Shared business logic
│   │   ├── propertyService.js
│   │   ├── leaseService.js
│   │   └── notificationService.js
│   └── middleware/        # Shared middleware
│
├── roles/
│   ├── agent/
│   │   ├── controllers/
│   │   │   ├── propertyController.js
│   │   │   ├── leaseController.js
│   │   │   └── notificationController.js
│   │   └── routes/
│   │       └── index.js
│   │
│   ├── agency/
│   │   ├── controllers/
│   │   │   ├── propertyController.js
│   │   │   └── commissionController.js
│   │   └── routes/
│   │       └── index.js
│   │
│   └── admin/
│       ├── controllers/
│       │   ├── propertyController.js
│       │   ├── notificationController.js
│       │   └── userController.js
│       └── routes/
│           └── index.js
│
└── common/                 # Shared across all roles
    ├── controllers/
    │   └── authController.js
    └── routes/
        └── auth.routes.js
```

### Option 2: Hybrid Approach (RECOMMENDED)
```
api/v1/
├── controllers/
│   ├── shared/            # Shared controllers
│   │   ├── authController.js
│   │   └── propertyController.js (if truly shared)
│   │
│   ├── agent/             # Agent-specific controllers
│   │   ├── propertyController.js
│   │   ├── leaseController.js
│   │   └── commissionController.js
│   │
│   ├── agency/            # Agency-specific controllers
│   │   ├── propertyController.js
│   │   ├── commissionController.js
│   │   └── agentController.js
│   │
│   └── admin/             # Admin-specific controllers
│       ├── propertyController.js
│       ├── notificationController.js
│       ├── userController.js
│       └── dashboardController.js
│
├── routes/
│   ├── shared/
│   │   └── auth.routes.js
│   │
│   ├── agent/
│   │   └── index.js       # Aggregates all agent routes
│   │
│   ├── agency/
│   │   └── index.js       # Aggregates all agency routes
│   │
│   └── admin/
│       └── index.js       # Aggregates all admin routes
│
└── services/              # Shared services (used by all roles)
    ├── propertyService.js
    ├── leaseService.js
    └── notificationService.js
```

## Benefits of Role-Based Organization

### ✅ Advantages
1. **Clear Separation**: Easy to see what each role can do
2. **Security**: Role-specific code is isolated
3. **Scalability**: Easy to add role-specific features
4. **Team Collaboration**: Different developers can work on different roles
5. **Maintenance**: Easier to find and update role-specific logic
6. **Testing**: Can test role-specific endpoints independently

### ⚠️ Considerations
1. **Code Duplication**: Some logic might be duplicated across roles
2. **Shared Logic**: Need clear strategy for shared business logic
3. **Migration**: Requires refactoring existing code

## Recommended Approach: Hybrid

### Structure
- **Services**: Keep shared (business logic is usually the same)
- **Controllers**: Organize by role (different roles have different needs)
- **Routes**: Organize by role (clear API structure)

### Example Flow
```
Request → Role Route → Role Controller → Shared Service → Database
```

### Implementation Strategy

1. **Phase 1: Create role folders**
   - Create `controllers/agent/`, `controllers/agency/`, `controllers/admin/`
   - Create `routes/agent/`, `routes/agency/`, `routes/admin/`

2. **Phase 2: Move role-specific controllers**
   - Move admin-specific controllers to `controllers/admin/`
   - Keep shared controllers in `controllers/shared/`

3. **Phase 3: Update routes**
   - Create role-specific route aggregators
   - Update `v1.routes.js` to use role-based routes

4. **Phase 4: Refactor gradually**
   - Move agent/agency controllers as needed
   - Keep services shared

## Example Route Structure

```javascript
// routes/agent/index.js
router.use('/properties', require('./property.routes'));
router.use('/leases', require('./lease.routes'));
router.use('/commissions', require('./commission.routes'));

// routes/admin/index.js
router.use('/properties', require('./property.routes'));
router.use('/notifications', require('./notification.routes'));
router.use('/users', require('./user.routes'));

// v1.routes.js
router.use('/agent', require('./routes/agent'));
router.use('/agency', require('./routes/agency'));
router.use('/admin', require('./routes/admin'));
router.use('/auth', require('./routes/shared/auth.routes'));
```

## Final API Structure

```
/api/v1/
├── auth/                    # Shared
├── agent/
│   ├── properties/
│   ├── leases/
│   └── commissions/
├── agency/
│   ├── properties/
│   ├── agents/
│   └── commissions/
└── admin/
    ├── properties/
    ├── notifications/
    ├── users/
    └── dashboard/
```
