const express = require("express");
const {
  sendEmail,
  getSentEmails,
  getInbox,
  getAvailableRecipients,
  getEmailReplies,
  getEmailThread,
  getThreadEmails,
  markEmailAsKyc,
} = require("../../controllers/agent/emailController");
const { isLoggedIn } = require("../../middleware/auth");
const { validateParamId } = require("../../../../utils/validateObjectId");

const router = express.Router();

router.use(isLoggedIn);

router.post("/send", sendEmail);
router.get("/sent", getSentEmails);
router.get("/inbox", getInbox);
router.get("/recipients", getAvailableRecipients);
router.patch("/:emailId/mark-kyc", validateParamId, markEmailAsKyc);
router.get("/:emailId/replies", validateParamId, getEmailReplies);
// Note: threadId is a UUID string, not ObjectId, so we skip validation for thread routes
router.get("/thread/:threadId", getEmailThread);
router.get("/thread/:threadId/emails", getThreadEmails);

module.exports = router;
