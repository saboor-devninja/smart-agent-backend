const express = require("express");
const authRoutes = require("./auth.routes");

const router = express.Router();

// Shared routes - accessible by all users
router.use("/auth", authRoutes);

module.exports = router;
