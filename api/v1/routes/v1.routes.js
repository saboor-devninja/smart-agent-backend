const express = require("express");
const authRoutes = require("./auth.routes");
const propertyRoutes = require("./property.routes");
const landlordRoutes = require("./landlord.routes");
const tenantRoutes = require("./tenant.routes");
const leaseRoutes = require("./lease.routes");
const uploadRoutes = require("./upload.routes");
const leasePrerequisiteRoutes = require("./leasePrerequisite.routes");
const leasePaymentRoutes = require("./leasePayment.routes");
const docusignRoutes = require("./docusign.routes");
const notificationPreferenceRoutes = require("./notificationPreference.routes");
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
router.use("/lease-prerequisites", leasePrerequisiteRoutes);
router.use("/lease-payments", leasePaymentRoutes);
router.use("/notification-preferences", notificationPreferenceRoutes);
// router.use("/finance", financeRoutes);
// router.use("/notifications", notificationRoutes);

module.exports = router;

