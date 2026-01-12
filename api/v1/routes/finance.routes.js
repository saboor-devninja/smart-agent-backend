const express = require("express");
const { isLoggedIn } = require("../middleware/auth");
const { getDashboard } = require("../controllers/financeDashboardController");
const { getCombinedStatements, getStatementDetails } = require("../controllers/statementController");

const router = express.Router();

router.use(isLoggedIn);

router.get("/dashboard", getDashboard);
router.get("/statements", getCombinedStatements);
router.get("/statements/:type/:id", getStatementDetails);

module.exports = router;


