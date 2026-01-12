const express = require("express");
const {
  getAdminNotifications,
  getRecipients,
  sendNotification,
} = require("../../controllers/admin/adminNotificationController");
const { isLoggedIn } = require("../../middleware/auth");

const router = express.Router();

// All admin notification routes require authentication
router.use(isLoggedIn);

router.get("/", getAdminNotifications);
router.get("/recipients", getRecipients);
router.post("/send", sendNotification);

module.exports = router;
