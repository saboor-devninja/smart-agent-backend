const express = require("express");
const multer = require("multer");
const {
  signup,
  signupAgency,
  login,
  getMe,
  createPlatformAdminDev,
  forgotPassword,
  verifyPasswordResetOTP,
  resetPassword,
  verifyEmailOTP,
  resendEmailOTP,
} = require("../../controllers/shared/authController");
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
router.post("/signup/agency", signupAgency);
router.post("/login", login);
router.get("/me", isLoggedIn, getMe);
router.post("/create-platform-admin-dev", createPlatformAdminDev);
router.post("/forgot-password", forgotPassword);
router.post("/verify-password-reset-otp", verifyPasswordResetOTP);
router.post("/reset-password", resetPassword);
router.post("/verify-email-otp", verifyEmailOTP);
router.post("/resend-email-otp", resendEmailOTP);
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

