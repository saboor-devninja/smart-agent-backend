const express = require("express");
const { isLoggedIn } = require("../../middleware/auth");
const controller = require("../../controllers/agent/leasePaymentController");
const {
  getByLease,
  create,
  update,
  getByIdWithRelated,
  getAll,
} = controller;
const deletePaymentRecord = controller.delete;
const { validateParamId } = require("../../../../utils/validateObjectId");

const router = express.Router();

router.use(isLoggedIn);

router.get("/list", getAll); // Must be before "/" route
router.get("/", getByLease);
router.get("/:id/related", validateParamId, getByIdWithRelated);
router.post("/", create);
router.patch("/:id", validateParamId, update);
router.delete("/:id", validateParamId, deletePaymentRecord);

module.exports = router;


