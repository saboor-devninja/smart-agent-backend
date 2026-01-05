const express = require("express");
const { signup, login, getMe } = require("../controllers/authController");
const { isLoggedIn } = require("../middleware/auth");

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.get("/me", isLoggedIn, getMe);

module.exports = router;

