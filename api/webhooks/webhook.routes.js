const express = require("express");
const { handleWebhook } = require("./docusign");

const router = express.Router();

router.post("/docusign", express.raw({ type: "application/json", limit: "10mb" }), (req, res) => {
  req.body = req.body.toString("utf8");
  handleWebhook(req, res);
});

router.get("/docusign", (req, res) => {
  res.status(200).json({ message: "DocuSign webhook endpoint is active and accessible" });
});

module.exports = router;

