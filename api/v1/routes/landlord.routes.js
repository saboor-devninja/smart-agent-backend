const express = require("express");
const multer = require("multer");
const Landlord = require("../../../models/Landlord");
const {
  createLandlord,
  getLandlords,
  getLandlord,
  updateLandlord,
  deleteLandlord,
  getLandlordsForSelect,
} = require("../controllers/agent/landlordController");
const { isLoggedIn } = require("../middleware/auth");
const { checkResourceOwnership } = require("../middleware/authorize");
const { validateParamId } = require("../../../utils/validateObjectId");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

// All landlord routes here are mounted at /api/v1/landlords

router.use(isLoggedIn);

// Create landlord
router.post("/", upload.single("profilePicture"), createLandlord);

// List landlords (filtering by role/ownership is handled in controller)
router.get("/", getLandlords);

// Get landlords for select dropdown
router.get("/select", getLandlordsForSelect);

// Get single landlord with ownership checks
router.get(
  "/:id",
  validateParamId,
  checkResourceOwnership({
    fetchResource: async (id) => await Landlord.findById(id),
    agentIdField: "agentId",
    agencyIdField: "agencyId",
  }),
  getLandlord
);

// Update landlord
router.patch(
  "/:id",
  validateParamId,
  upload.single("profilePicture"),
  checkResourceOwnership({
    fetchResource: async (id) => await Landlord.findById(id),
    agentIdField: "agentId",
    agencyIdField: "agencyId",
  }),
  updateLandlord
);

// Delete landlord
router.delete(
  "/:id",
  validateParamId,
  checkResourceOwnership({
    fetchResource: async (id) => await Landlord.findById(id),
    agentIdField: "agentId",
    agencyIdField: "agencyId",
  }),
  deleteLandlord
);

module.exports = router;

