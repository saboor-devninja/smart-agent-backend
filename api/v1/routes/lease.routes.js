const express = require("express");
const multer = require("multer");
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
} = require("../controllers/leaseController");
const { isLoggedIn } = require("../middleware/auth");
const { checkResourceOwnership } = require("../middleware/authorize");
const Lease = require("../../../models/Lease");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(isLoggedIn);

const uploadFields = [];
for (let i = 0; i < 10; i++) {
  uploadFields.push({ name: `documents[${i}][file]`, maxCount: 1 });
  uploadFields.push({ name: `docusignDocuments[${i}][file]`, maxCount: 1 });
}
uploadFields.push({ name: "inspectionMedia", maxCount: 10 });

router.post("/", upload.fields(uploadFields), createLease);

router.get("/", getLeases);

router.get(
  "/:id",
  checkResourceOwnership({
    fetchResource: async (id) => await Lease.findById(id),
    agentIdField: 'agentId',
    agencyIdField: 'agencyId',
  }),
  getLeaseById
);

router.patch(
  "/:id",
  checkResourceOwnership({
    fetchResource: async (id) => await Lease.findById(id),
    agentIdField: 'agentId',
    agencyIdField: 'agencyId',
  }),
  upload.fields(uploadFields),
  updateLease
);

router.patch(
  "/:id/pending-start",
  checkResourceOwnership({
    fetchResource: async (id) => await Lease.findById(id),
    agentIdField: 'agentId',
    agencyIdField: 'agencyId',
  }),
  moveToPendingStart
);

router.patch(
  "/:id/activate",
  checkResourceOwnership({
    fetchResource: async (id) => await Lease.findById(id),
    agentIdField: 'agentId',
    agencyIdField: 'agencyId',
  }),
  activateLease
);

router.patch(
  "/:id/terminate",
  checkResourceOwnership({
    fetchResource: async (id) => await Lease.findById(id),
    agentIdField: 'agentId',
    agencyIdField: 'agencyId',
  }),
  terminateLease
);

router.patch(
  "/:id/cancel",
  checkResourceOwnership({
    fetchResource: async (id) => await Lease.findById(id),
    agentIdField: 'agentId',
    agencyIdField: 'agencyId',
  }),
  cancelLease
);

router.delete(
  "/:id",
  checkResourceOwnership({
    fetchResource: async (id) => await Lease.findById(id),
    agentIdField: 'agentId',
    agencyIdField: 'agencyId',
  }),
  deleteLease
);

module.exports = router;

