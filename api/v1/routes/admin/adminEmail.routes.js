const express = require("express");
const {
  sendEmail,
  getSentEmails,
  getEmailReplies,
  getEmailThread,
  getThreadEmails,
} = require("../../controllers/adminEmailController");
const { isLoggedIn } = require("../../middleware/auth");

const router = express.Router();

// All admin email routes require authentication and PLATFORM_ADMIN (checked in controller)
router.use(isLoggedIn);

router.post("/send", sendEmail);
router.get("/sent", getSentEmails);
router.get("/:emailId/replies", getEmailReplies);
router.get("/thread/:threadId", getEmailThread);
router.get("/thread/:threadId/emails", getThreadEmails);

module.exports = router;

