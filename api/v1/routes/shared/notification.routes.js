const express = require("express");
const { sseHandler } = require("../../controllers/agent/notificationController");

const router = express.Router();

router.get("/sse", sseHandler);

module.exports = router;
