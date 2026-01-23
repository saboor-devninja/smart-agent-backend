const express = require("express");
const { isLoggedIn } = require("../../middleware/auth");
const {
  uploadLandlordPropertyFile,
  importLandlordsAndProperties,
} = require("../../controllers/agent/landlordPropertyImportController");
const {
  uploadPropertyFile,
  uploadProperties,
  downloadTemplate,
} = require("../../controllers/agent/propertyImportController");

const router = express.Router();

router.use(isLoggedIn);

// Landlord + Property bulk import (CSV exported from Excel)
router.post(
  "/landlords-properties/upload",
  uploadLandlordPropertyFile,
  importLandlordsAndProperties
);

// Property-only import (links to existing landlords by contact email)
router.post(
  "/properties/upload",
  uploadPropertyFile,
  uploadProperties
);

router.get(
  "/properties/template",
  downloadTemplate
);

module.exports = router;

