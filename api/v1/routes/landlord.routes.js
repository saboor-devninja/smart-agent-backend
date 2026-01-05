const express = require("express");
const multer = require("multer");
const Landlord = require("../../../models/Landlord");
const { 
  createLandlord, 
  getLandlords, 
  getLandlord, 
  updateLandlord, 
  deleteLandlord,
  getLandlordsForSelect
} = require("../controllers/landlordController");
const { isLoggedIn } = require("../middleware/auth");
const { restrictTo, checkResourceOwnership } = require("../middleware/authorize");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

router.use(isLoggedIn);

// All authenticated users can create landlords
router.post("/", upload.single("profilePicture"), createLandlord);

// All authenticated users can list landlords (filtering happens in controller)
router.get("/", getLandlords);

// All authenticated users can get landlords for select dropdown
router.get("/select", getLandlordsForSelect);

// All authenticated users can view landlords (ownership checked in middleware)
router.get(
  "/:id",
  checkResourceOwnership({
    fetchResource: async (id) => await Landlord.findById(id),
    agentIdField: 'agentId',
    agencyIdField: 'agencyId',
  }),
  getLandlord
);

// All authenticated users can update landlords (ownership checked in middleware)
router.patch(
  "/:id",
  upload.single("profilePicture"),
  checkResourceOwnership({
    fetchResource: async (id) => await Landlord.findById(id),
    agentIdField: 'agentId',
    agencyIdField: 'agencyId',
  }),
  updateLandlord
);

// All authenticated users can delete landlords (ownership checked in middleware)
router.delete(
  "/:id",
  checkResourceOwnership({
    fetchResource: async (id) => await Landlord.findById(id),
    agentIdField: 'agentId',
    agencyIdField: 'agencyId',
  }),
  deleteLandlord
);

module.exports = router;

