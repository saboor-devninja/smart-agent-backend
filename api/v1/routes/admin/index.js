const express = require("express");
const adminNotificationRoutes = require("./adminNotification.routes");
const adminEmailRoutes = require("./adminEmail.routes");
const adminUserRoutes = require("./adminUser.routes");

const router = express.Router();

// Admin routes - accessible by PLATFORM_ADMIN only
router.use("/notifications", adminNotificationRoutes);
router.use("/emails", adminEmailRoutes);
router.use("/", adminUserRoutes);

module.exports = router;
