const express = require("express");
const multer = require("multer");
const Tenant = require("../../../../models/Tenant");
const {
  createTenant,
  getTenants,
  getTenant,
  updateTenant,
  deleteTenant,
  getTenantsForSelect,
  updateKycStatus,
} = require("../../controllers/agent/tenantController");
const { isLoggedIn } = require("../../middleware/auth");
const { restrictTo, checkResourceOwnership } = require("../../middleware/authorize");
const { validateParamId } = require("../../../../utils/validateObjectId");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

router.use(isLoggedIn);

router.post("/", upload.single("profilePicture"), createTenant);

router.get("/", getTenants);

router.get("/select", getTenantsForSelect);

router.get(
  "/:id",
  validateParamId,
  checkResourceOwnership({
    fetchResource: async (id) => await Tenant.findById(id),
    agentIdField: "agentId",
    agencyIdField: "agencyId",
  }),
  getTenant
);

router.patch(
  "/:id/kyc-status",
  validateParamId,
  checkResourceOwnership({
    fetchResource: async (id) => await Tenant.findById(id),
    agentIdField: "agentId",
    agencyIdField: "agencyId",
  }),
  updateKycStatus
);

router.patch(
  "/:id",
  validateParamId,
  upload.single("profilePicture"),
  checkResourceOwnership({
    fetchResource: async (id) => await Tenant.findById(id),
    agentIdField: "agentId",
    agencyIdField: "agencyId",
  }),
  updateTenant
);

router.delete(
  "/:id",
  validateParamId,
  checkResourceOwnership({
    fetchResource: async (id) => await Tenant.findById(id),
    agentIdField: "agentId",
    agencyIdField: "agencyId",
  }),
  deleteTenant
);

module.exports = router;

