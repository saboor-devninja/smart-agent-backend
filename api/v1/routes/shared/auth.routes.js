const express = require("express");
const multer = require("multer");
const { signup, login, getMe, createPlatformAdminDev } = require("../../controllers/shared/authController");
const { updateProfile, changePassword } = require("../../controllers/shared/userController");
const { isLoggedIn } = require("../../middleware/auth");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

router.post("/signup", signup);
router.post("/login", login);
router.get("/me", isLoggedIn, getMe);

// DEV-ONLY route to create initial PLATFORM_ADMIN user
// IMPORTANT: Comment/remove this route before going live
router.post("/create-platform-admin-dev", createPlatformAdminDev);
router.patch(
  "/profile",
  isLoggedIn,
  upload.fields([
    { name: "profilePicture", maxCount: 1 },
    { name: "companyLogo", maxCount: 1 },
  ]),
  updateProfile
);
router.patch("/change-password", isLoggedIn, changePassword);

module.exports = router;

