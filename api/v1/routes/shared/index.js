const express = require("express");
const authRoutes = require("./auth.routes");
const notificationRoutes = require("./notification.routes");
const webhookRoutes = require("./webhook.routes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/notifications", notificationRoutes);
router.use("/webhooks", webhookRoutes);

module.exports = router;
