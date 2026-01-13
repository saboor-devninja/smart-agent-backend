const express = require("express");
const { isLoggedIn } = require("../../middleware/auth");
const {
  getByLease,
  create,
  update,
  getByIdWithRelated,
} = require("../../controllers/agent/leasePaymentController");
const { validateParamId } = require("../../../../utils/validateObjectId");

const router = express.Router();

router.use(isLoggedIn);

router.get("/", getByLease);
router.get("/:id/related", validateParamId, getByIdWithRelated);
router.post("/", create);
router.patch("/:id", validateParamId, update);

module.exports = router;


