const express = require("express");
const {
  getNotifications,
  getUnreadCount,
  getStats,
  markAsRead,
  markAllAsRead,
  archive,
  sseHandler,
} = require("../../controllers/agent/notificationController");
const { isLoggedIn } = require("../../middleware/auth");

const router = express.Router();

// Regular API routes (require authentication)
router.use(isLoggedIn);

router.get("/", getNotifications);
router.get("/unread-count", getUnreadCount);
router.get("/stats", getStats);
router.patch("/read", markAsRead);
router.patch("/read-all", markAllAsRead);
router.patch("/archive", archive);

// SSE endpoint (handles auth in controller via token in query)
router.get("/sse", sseHandler);

module.exports = router;
