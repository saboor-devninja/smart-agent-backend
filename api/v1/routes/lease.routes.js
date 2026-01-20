const express = require("express");
const multer = require("multer");
const Lease = require("../../../models/Lease");
const {
  createLease,
  getLeases,
  getLeaseById,
  updateLease,
  deleteLease,
  moveToPendingStart,
  activateLease,
  terminateLease,
  cancelLease,
} = require("../controllers/agent/leaseController");
const { isLoggedIn } = require("../middleware/auth");
const { checkResourceOwnership } = require("../middleware/authorize");
const { validateParamId } = require("../../../utils/validateObjectId");
const docusignRoutes = require("./agent/docusign.routes");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(isLoggedIn);

const uploadFields = [];
for (let i = 0; i < 10; i++) {
  uploadFields.push({ name: `documents[${i}][file]`, maxCount: 1 });
  uploadFields.push({ name: `docusignDocuments[${i}][file]`, maxCount: 1 });
}
uploadFields.push({ name: "inspectionMedia", maxCount: 10 });

// Create lease
router.post("/", upload.fields(uploadFields), createLease);

// List leases (filtering by role/ownership is handled in controller)
router.get("/", getLeases);

// Get single lease with ownership checks
router.get(
  "/:id",
  validateParamId,
  checkResourceOwnership({
    fetchResource: async (id) => await Lease.findById(id),
    agentIdField: "agentId",
    agencyIdField: "agencyId",
  }),
  getLeaseById
);

// Update lease
router.patch(
  "/:id",
  validateParamId,
  checkResourceOwnership({
    fetchResource: async (id) => await Lease.findById(id),
    agentIdField: "agentId",
    agencyIdField: "agencyId",
  }),
  upload.fields(uploadFields),
  updateLease
);

// Move lease to pending start
router.patch(
  "/:id/pending-start",
  validateParamId,
  checkResourceOwnership({
    fetchResource: async (id) => await Lease.findById(id),
    agentIdField: "agentId",
    agencyIdField: "agencyId",
  }),
  moveToPendingStart
);

// Activate lease
router.patch(
  "/:id/activate",
  validateParamId,
  checkResourceOwnership({
    fetchResource: async (id) => await Lease.findById(id),
    agentIdField: "agentId",
    agencyIdField: "agencyId",
  }),
  activateLease
);

// Terminate lease
router.patch(
  "/:id/terminate",
  validateParamId,
  checkResourceOwnership({
    fetchResource: async (id) => await Lease.findById(id),
    agentIdField: "agentId",
    agencyIdField: "agencyId",
  }),
  terminateLease
);

// Cancel lease
router.patch(
  "/:id/cancel",
  validateParamId,
  checkResourceOwnership({
    fetchResource: async (id) => await Lease.findById(id),
    agentIdField: "agentId",
    agencyIdField: "agencyId",
  }),
  cancelLease
);

// Delete lease
router.delete(
  "/:id",
  validateParamId,
  checkResourceOwnership({
    fetchResource: async (id) => await Lease.findById(id),
    agentIdField: "agentId",
    agencyIdField: "agencyId",
  }),
  deleteLease
);

// DocuSign routes (mounted at /leases/docusign)
router.use("/docusign", docusignRoutes);

module.exports = router;
