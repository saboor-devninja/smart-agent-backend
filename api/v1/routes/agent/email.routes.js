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

const router = express.Router();

router.use(isLoggedIn);

router.post("/send", sendEmail);
router.get("/sent", getSentEmails);
router.get("/inbox", getInbox);
router.get("/recipients", getAvailableRecipients);
router.patch("/:emailId/mark-kyc", markEmailAsKyc);
router.get("/:emailId/replies", getEmailReplies);
router.get("/thread/:threadId", getEmailThread);
router.get("/thread/:threadId/emails", getThreadEmails);

module.exports = router;
