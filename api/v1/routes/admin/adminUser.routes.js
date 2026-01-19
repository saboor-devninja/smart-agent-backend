const express = require("express");
const { getAllUsers } = require("../../controllers/admin/adminUserController");
const { isLoggedIn } = require("../../middleware/auth");

const router = express.Router();

// All routes require authentication
router.use(isLoggedIn);

// GET /api/v1/admin/users - Get all users (PLATFORM_ADMIN only)
router.get("/users", getAllUsers);

module.exports = router;
