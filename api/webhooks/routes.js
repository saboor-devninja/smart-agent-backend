const express = require("express");
const { handleDocuSignWebhook } = require("./docusign");
const bodyParser = require("body-parser");

const router = express.Router();

const rawBodyParser = bodyParser.raw({ 
  type: "application/json", 
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
});

// GET endpoint for webhook verification (DocuSign may ping this)
router.get("/docusign", (req, res) => {
  console.log("📡 DocuSign webhook GET request (verification ping)");
  res.status(200).json({ 
    message: "DocuSign webhook endpoint is active",
    timestamp: new Date().toISOString()
  });
});

// POST endpoint for actual webhook events
router.post("/docusign", rawBodyParser, (req, res) => {
  console.log("📡 DocuSign webhook POST request received");
  try {
    req.body = req.rawBody ? JSON.parse(req.rawBody.toString()) : req.body;
  } catch (e) {
    console.error("❌ Failed to parse webhook body:", e);
    return res.status(400).json({ error: "invalid json" });
  }
  handleDocuSignWebhook(req, res);
});

module.exports = router;
