const express = require("express");
const { getAllUsers, getAgencies, createUser, setUserCurrency } = require("../../controllers/admin/adminUserController");
const { isLoggedIn } = require("../../middleware/auth");
const { validateParamId } = require("../../../../utils/validateObjectId");

const router = express.Router();

// All routes require authentication
router.use(isLoggedIn);

// GET /api/v1/admin/users - Get all users (PLATFORM_ADMIN only)
router.get("/users", getAllUsers);

// POST /api/v1/admin/users - Create a new user (PLATFORM_ADMIN only)
router.post("/users", createUser);

// PATCH /api/v1/admin/users/:id/currency - Set currency for a user (PLATFORM_ADMIN only)
router.patch("/users/:id/currency", validateParamId, setUserCurrency);

// GET /api/v1/admin/agencies - Get all agencies for selection (PLATFORM_ADMIN only)
router.get("/agencies", getAgencies);

module.exports = router;
