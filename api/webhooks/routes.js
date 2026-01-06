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

router.post("/docusign", rawBodyParser, (req, res) => {
  try {
    req.body = req.rawBody ? JSON.parse(req.rawBody.toString()) : req.body;
  } catch (e) {
    return res.status(400).json({ error: "invalid json" });
  }
  handleDocuSignWebhook(req, res);
});

module.exports = router;
