const express = require("express");
const adminNotificationRoutes = require("./adminNotification.routes");
const adminEmailRoutes = require("./adminEmail.routes");
const adminUserRoutes = require("./adminUser.routes");
const { getDashboardStats } = require("../../controllers/admin/adminDashboardController");
const { isLoggedIn } = require("../../middleware/auth");

const router = express.Router();

// All routes require authentication
router.use(isLoggedIn);

// Admin routes - accessible by PLATFORM_ADMIN only
router.get("/dashboard/stats", getDashboardStats);
router.use("/notifications", adminNotificationRoutes);
router.use("/emails", adminEmailRoutes);
router.use("/", adminUserRoutes);

module.exports = router;
