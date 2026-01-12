const express = require("express");

// Role-based route aggregators
const sharedRoutes = require("./shared");
const agentRoutes = require("./agent");
const adminRoutes = require("./admin");

const router = express.Router();

// Shared routes (auth, etc.) - accessible by all
router.use("/", sharedRoutes);

// Agent routes - accessible by AGENT, AGENCY_ADMIN, and PLATFORM_ADMIN
// These routes handle role-based filtering internally
router.use("/agent", agentRoutes);

// Admin routes - accessible by PLATFORM_ADMIN only
router.use("/admin", adminRoutes);

module.exports = router;
