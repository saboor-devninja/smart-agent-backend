const express = require("express");
const adminNotificationRoutes = require("./adminNotification.routes");

const router = express.Router();

// Admin routes - accessible by PLATFORM_ADMIN only
router.use("/notifications", adminNotificationRoutes);

module.exports = router;
