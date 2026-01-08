const express = require("express");
const { isLoggedIn } = require("../middleware/auth");
const {
  getAgentCommissions,
  getLandlordPayments,
  getRelatedByPayment,
  getRelatedByCommission,
  getRelatedByLandlordPayment,
} = require("../controllers/commissionController");

const router = express.Router();

router.use(isLoggedIn);

router.get("/agent", getAgentCommissions);
router.get("/landlord/:landlordId", getLandlordPayments);
router.get("/related/payment/:paymentRecordId", getRelatedByPayment);
router.get("/related/commission/:commissionRecordId", getRelatedByCommission);
router.get("/related/landlord-payment/:landlordPaymentId", getRelatedByLandlordPayment);

module.exports = router;

