/**
 * Check payment and commission records for a lease
 * Usage: node scripts/check-lease-payments.js LSE-2026-005
 */

try {
  require("dotenv").config();
} catch (e) {}

const mongoose = require("mongoose");
const path = require("path");
const leaseNumber = process.argv[2] || "LSE-2026-005";

let config;
try {
  config = require(path.join(__dirname, "../config/config"));
} catch (e) {
  console.error("Error loading config");
  process.exit(1);
}

require("../models/Lease");
require("../models/LeasePaymentRecord");
require("../models/CommissionRecord");

const Lease = require("../models/Lease");
const LeasePaymentRecord = require("../models/LeasePaymentRecord");
const CommissionRecord = require("../models/CommissionRecord");

async function run() {
  await mongoose.connect(config.mongodb.uri);

  const lease = await Lease.findOne({ leaseNumber }).lean();
  if (!lease) {
    console.log("Lease not found:", leaseNumber);
    process.exit(1);
  }

  const payments = await LeasePaymentRecord.find({ leaseId: lease._id })
    .sort({ dueDate: 1 })
    .lean();

  const commissions = await CommissionRecord.find({ leaseId: lease._id })
    .sort({ docNumber: 1 })
    .lean();

  console.log("\nLease:", leaseNumber, "| Property:", lease.propertyId);
  console.log("Payments:", payments.length);
  payments.forEach((p, i) => {
    console.log(
      `  ${i + 1}. ${p._id} | ${p.label} | ${p.status} | due: ${p.dueDate} | commissionRecordId: ${p.commissionRecordId || "none"}`
    );
  });
  console.log("\nCommissions:", commissions.length);
  commissions.forEach((c, i) => {
    console.log(
      `  ${i + 1}. doc#${c.docNumber} | paymentRecordId: ${c.paymentRecordId} | ${c.status}`
    );
  });

  // Check for paymentRecordId shared by multiple commissions
  const byPaymentId = {};
  commissions.forEach((c) => {
    const pid = c.paymentRecordId;
    if (!byPaymentId[pid]) byPaymentId[pid] = [];
    byPaymentId[pid].push(c);
  });
  const dupes = Object.entries(byPaymentId).filter(([, list]) => list.length > 1);
  if (dupes.length) {
    console.log("\n⚠️ Duplicate commissions (same paymentRecordId):", dupes);
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
