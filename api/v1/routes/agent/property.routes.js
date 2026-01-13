const express = require("express");
const multer = require("multer");
const Property = require("../../../../models/Property");
const { 
  createProperty, 
  getProperties, 
  getProperty, 
  updateProperty, 
  deleteProperty 
} = require("../../controllers/agent/propertyController");
const { isLoggedIn } = require("../../middleware/auth");
const { checkResourceOwnership } = require("../../middleware/authorize");
const { validateParamId } = require("../../../../utils/validateObjectId");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit per file
  },
});

router.use(isLoggedIn);

// All authenticated users can create properties
router.post("/", upload.array("mediaFiles", 10), createProperty);

// All authenticated users can list properties (filtering happens in controller)
router.get("/", getProperties);

// All authenticated users can view properties (ownership checked in middleware)
router.get(
  "/:id",
  validateParamId,
  checkResourceOwnership({
    fetchResource: async (id) => await Property.findById(id),
    agentIdField: 'agentId',
    agencyIdField: 'agencyId',
  }),
  getProperty
);

// All authenticated users can update properties (ownership checked in middleware)
router.patch(
  "/:id",
  validateParamId,
  upload.array("mediaFiles", 10),
  checkResourceOwnership({
    fetchResource: async (id) => await Property.findById(id),
    agentIdField: 'agentId',
    agencyIdField: 'agencyId',
  }),
  updateProperty
);

// All authenticated users can delete properties (ownership checked in middleware)
router.delete(
  "/:id",
  validateParamId,
  checkResourceOwnership({
    fetchResource: async (id) => await Property.findById(id),
    agentIdField: 'agentId',
    agencyIdField: 'agencyId',
  }),
  deleteProperty
);

module.exports = router;

