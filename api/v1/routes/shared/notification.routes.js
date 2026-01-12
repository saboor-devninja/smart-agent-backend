const express = require("express");
const { sseHandler } = require("../../controllers/agent/notificationController");

const router = express.Router();

// SSE endpoint (handles auth in controller via token in query)
// This is shared because all authenticated users need real-time notifications
router.get("/sse", sseHandler);

module.exports = router;
