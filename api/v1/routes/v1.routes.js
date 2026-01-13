const express = require("express");

const sharedRoutes = require("./shared");
const agentRoutes = require("./agent");
const adminRoutes = require("./admin");

const router = express.Router();

router.use("/", sharedRoutes);
router.use("/agent", agentRoutes);
router.use("/admin", adminRoutes);

module.exports = router;
