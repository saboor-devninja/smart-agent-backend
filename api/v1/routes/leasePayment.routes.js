const express = require("express");
const { isLoggedIn } = require("../middleware/auth");
const {
  getByLease,
  create,
  update,
  getByIdWithRelated,
} = require("../controllers/leasePaymentController");

const router = express.Router();

router.use(isLoggedIn);

router.get("/", getByLease);
router.get("/:id/related", getByIdWithRelated);
router.post("/", create);
router.patch("/:id", update);

module.exports = router;


