const express = require("express");
const { resendWebhook } = require("../../controllers/shared/webhookController");

const router = express.Router();

router.post("/resend", resendWebhook);

module.exports = router;
