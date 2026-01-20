const express = require("express");

const sharedRoutes = require("./shared");
const agentRoutes = require("./agent");
const adminRoutes = require("./admin");
const landlordRoutes = require("./landlord.routes");
const propertyRoutes = require("./property.routes");
const leaseRoutes = require("./lease.routes");

const router = express.Router();

router.use("/", sharedRoutes);
router.use("/agent", agentRoutes);
router.use("/admin", adminRoutes);
router.use("/landlords", landlordRoutes);
router.use("/properties", propertyRoutes);
router.use("/leases", leaseRoutes);

module.exports = router;
