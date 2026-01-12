const express = require("express");
const multer = require("multer");
const { isLoggedIn } = require("../../middleware/auth");
const {
  getForLease,
  create,
  updateStatus,
  manualSign,
} = require("../../controllers/agent/leasePrerequisiteController");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(isLoggedIn);

router.get("/", getForLease);
router.post("/", create);
router.patch("/:id/status", updateStatus);
router.post("/:id/manual-sign", upload.single("file"), manualSign);

module.exports = router;


