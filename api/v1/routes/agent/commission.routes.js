const express = require("express");
const { isLoggedIn } = require("../../middleware/auth");
const { validateParamId } = require("../../../../utils/validateObjectId");
const { validateParamLeasePaymentRecordId } = require("../../../../utils/validateObjectId");
const {
  getAgentCommissions,
  getLandlordPayments,
  getRelatedByPayment,
  getRelatedByCommission,
  getRelatedByLandlordPayment,
  updateLandlordPayment,
  markPlatformFeeAsPaid,
  markPlatformFeeAsPaidByPaymentRecord,
} = require("../../controllers/agent/commissionController");

const router = express.Router();

router.use(isLoggedIn);

router.get("/agent", getAgentCommissions);
router.patch(
  "/platform-fee/records/:leasePaymentRecordId/paid",
  validateParamLeasePaymentRecordId,
  markPlatformFeeAsPaidByPaymentRecord
);
router.get("/landlord/:landlordId", getLandlordPayments);
router.get("/related/payment/:paymentRecordId", getRelatedByPayment);
router.get("/related/commission/:commissionRecordId", getRelatedByCommission);
router.get("/related/landlord-payment/:landlordPaymentId", getRelatedByLandlordPayment);
router.patch("/landlord-payment/:landlordPaymentId", updateLandlordPayment);
router.patch("/:id/platform-fee/paid", validateParamId, markPlatformFeeAsPaid);

module.exports = router;

