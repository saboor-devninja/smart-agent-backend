const express = require("express");
const { isLoggedIn } = require("../../middleware/auth");
const { restrictTo } = require("../../middleware/authorize");
const {
  getAgencyAgents,
  createAgent,
  getAgentDetail,
  updateAgent,
  deleteAgent,
} = require("../../controllers/agent/agentController");
const { validateParamId } = require("../../../../utils/validateObjectId");

const router = express.Router();

// All routes require authentication and AGENCY_ADMIN role
router.use(isLoggedIn);
router.use(restrictTo("AGENCY_ADMIN"));

router.get("/", getAgencyAgents);
router.post("/", createAgent);
router.get("/:id", validateParamId, getAgentDetail);
router.patch("/:id", validateParamId, updateAgent);
router.delete("/:id", validateParamId, deleteAgent);

module.exports = router;
