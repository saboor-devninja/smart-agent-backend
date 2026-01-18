const express = require("express");
const { isLoggedIn } = require("../../middleware/auth");
const { getDashboard } = require("../../controllers/agent/financeDashboardController");
const { getCombinedStatements, getStatementDetails, getGenericStatement } = require("../../controllers/agent/statementController");
const {
  uploadStatementFile,
  uploadStatement,
  getImport,
  applyImport,
  checkExistingRecords,
} = require("../../controllers/agent/statementImportController");
const { generatePDF } = require("../../controllers/agent/pdfController");

const router = express.Router();

router.use(isLoggedIn);

router.get("/dashboard", getDashboard);
router.get("/statements", getCombinedStatements);
router.get("/statements/generic", getGenericStatement);
router.get("/statements/:type/:id", getStatementDetails);

// Bank statement import (agent-side)
router.post("/imports/upload", uploadStatementFile, uploadStatement);
router.get("/imports/check-records", checkExistingRecords);
router.get("/imports/:id", getImport);
router.post("/imports/:id/apply", applyImport);

// PDF generation for email attachments
router.post("/pdf/generate", generatePDF);

module.exports = router;


