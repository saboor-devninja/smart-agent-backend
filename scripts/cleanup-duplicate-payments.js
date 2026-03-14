/**
 * Find and remove duplicate RENT payments (same lease, same month)
 * Keeps the older payment, removes the duplicate and its commission/landlord payment
 *
 * Usage: node scripts/cleanup-duplicate-payments.js [--dry-run]
 */

try {
  require("dotenv").config();
} catch (e) {}

const mongoose = require("mongoose");
const path = require("path");
const dryRun = process.argv.includes("--dry-run");

let config;
try {
  config = require(path.join(__dirname, "../config/config"));
} catch (e) {
  console.error("Error loading config");
  process.exit(1);
}

require("../models/LeasePaymentRecord");
require("../models/CommissionRecord");
require("../models/LandlordPayment");

const LeasePaymentRecord = require("../models/LeasePaymentRecord");
const CommissionRecord = require("../models/CommissionRecord");
const LandlordPayment = require("../models/LandlordPayment");

function monthKey(d) {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

async function run() {
  await mongoose.connect(config.mongodb.uri);

  const rentPayments = await LeasePaymentRecord.find({ type: "RENT" })
    .sort({ leaseId: 1, dueDate: 1, createdAt: 1 })
    .lean();

  // Group by leaseId + month
  const byLeaseMonth = new Map();
  for (const p of rentPayments) {
    const key = `${p.leaseId}|${monthKey(p.dueDate)}`;
    if (!byLeaseMonth.has(key)) byLeaseMonth.set(key, []);
    byLeaseMonth.get(key).push(p);
  }

  const duplicates = [...byLeaseMonth.entries()].filter(([, list]) => list.length > 1);

  if (duplicates.length === 0) {
    console.log("✅ No duplicate rent payments (same lease + month) found.");
    await mongoose.disconnect();
    process.exit(0);
    return;
  }

  console.log(`\nFound ${duplicates.length} month(s) with duplicate payments:\n`);

  let removed = 0;
  for (const [key, payments] of duplicates) {
    const [leaseId, month] = key.split("|");
    // Keep oldest (first by createdAt), remove the rest
    const keep = payments[0];
    const toRemove = payments.slice(1);

    console.log(`  Lease ${leaseId} | ${month}: keeping "${keep.label}" (${keep._id})`);

    for (const dup of toRemove) {
      console.log(`    Removing: "${dup.label}" (${dup._id})`);
      if (!dryRun) {
        if (dup.commissionRecordId) {
          await CommissionRecord.deleteOne({ _id: dup.commissionRecordId });
          await LandlordPayment.deleteMany({ commissionRecordId: dup.commissionRecordId });
        }
        if (dup.landlordPaymentId) {
          await LandlordPayment.deleteOne({ _id: dup.landlordPaymentId });
        }
        await LeasePaymentRecord.deleteOne({ _id: dup._id });
        removed++;
      }
    }
  }

  if (dryRun) {
    console.log("\n⚠️  Dry run - no changes made. Run without --dry-run to apply.");
  } else {
    console.log(`\n✅ Removed ${removed} duplicate payment(s)`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
