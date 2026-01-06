const express = require("express");
const { isLoggedIn } = require("../middleware/auth");
const {
  getByLease,
  create,
  update,
} = require("../controllers/leasePaymentController");

const router = express.Router();

router.use(isLoggedIn);

router.get("/", getByLease);
router.post("/", create);
router.patch("/:id", update);

module.exports = router;


