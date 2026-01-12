const express = require("express");
const authRoutes = require("./auth.routes");
const notificationRoutes = require("./notification.routes");

const router = express.Router();

// Shared routes - accessible by all users
router.use("/auth", authRoutes);
router.use("/notifications", notificationRoutes);

module.exports = router;
