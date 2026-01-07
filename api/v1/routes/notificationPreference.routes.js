const express = require("express");
const { getPreferences, updatePreferences } = require("../controllers/notificationPreferenceController");
const { isLoggedIn } = require("../middleware/auth");

const router = express.Router();

router.use(isLoggedIn);

router.get("/", getPreferences);
router.patch("/", updatePreferences);

module.exports = router;

