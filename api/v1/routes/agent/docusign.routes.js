const express = require("express");
const multer = require("multer");
const { createEnvelope, getSigningUrl, sendSigningEmails } = require("../../controllers/agent/docusignController");
const { isLoggedIn } = require("../../middleware/auth");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(isLoggedIn);

const uploadFields = [];
for (let i = 0; i < 10; i++) {
  uploadFields.push({ name: `documents[${i}][file]`, maxCount: 1 });
}

router.post("/envelope", upload.fields(uploadFields), createEnvelope);

router.get("/:envelopeId/signing-url", getSigningUrl);

router.post("/:envelopeId/send-emails", sendSigningEmails);

module.exports = router;

