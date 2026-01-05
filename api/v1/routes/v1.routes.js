const express = require("express");
const authRoutes = require("./auth.routes");
const propertyRoutes = require("./property.routes");
const landlordRoutes = require("./landlord.routes");
const tenantRoutes = require("./tenant.routes");
const leaseRoutes = require("./lease.routes");
const uploadRoutes = require("./upload.routes");
const docusignRoutes = require("./docusign.routes");
// const financeRoutes = require("./finance.routes");
// const notificationRoutes = require("./notification.routes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/properties", propertyRoutes);
router.use("/landlords", landlordRoutes);
router.use("/tenants", tenantRoutes);
router.use("/leases", leaseRoutes);
router.use("/upload", uploadRoutes);
router.use("/leases/docusign", docusignRoutes);
// router.use("/finance", financeRoutes);
// router.use("/notifications", notificationRoutes);

module.exports = router;

