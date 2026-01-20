const express = require("express");
const multer = require("multer");
const Property = require("../../../models/Property");
const {
  createProperty,
  getProperties,
  getProperty,
  updateProperty,
  deleteProperty,
} = require("../controllers/agent/propertyController");
const { isLoggedIn } = require("../middleware/auth");
const { checkResourceOwnership } = require("../middleware/authorize");
const { validateParamId } = require("../../../utils/validateObjectId");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file
  },
});

// Require auth for all property routes
router.use(isLoggedIn);

// Create property
router.post("/", upload.array("mediaFiles", 10), createProperty);

// List properties (filters handled in controller based on role)
router.get("/", getProperties);

// Get single property with ownership check
router.get(
  "/:id",
  validateParamId,
  checkResourceOwnership({
    fetchResource: async (id) => await Property.findById(id),
    agentIdField: "agentId",
    agencyIdField: "agencyId",
  }),
  getProperty
);

// Update property
router.patch(
  "/:id",
  validateParamId,
  upload.array("mediaFiles", 10),
  checkResourceOwnership({
    fetchResource: async (id) => await Property.findById(id),
    agentIdField: "agentId",
    agencyIdField: "agencyId",
  }),
  updateProperty
);

// Delete property
router.delete(
  "/:id",
  validateParamId,
  checkResourceOwnership({
    fetchResource: async (id) => await Property.findById(id),
    agentIdField: "agentId",
    agencyIdField: "agencyId",
  }),
  deleteProperty
);

module.exports = router;

