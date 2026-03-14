/**
 * Remove duplicate commission records (keep one per paymentRecordId)
 * Run this if backfill or concurrent requests created duplicates
 *
 * Usage: node scripts/cleanup-duplicate-commissions.js
 */

try {
  require("dotenv").config();
} catch (error) {
  console.warn("⚠️  dotenv not available");
}

const mongoose = require("mongoose");
const path = require("path");

let config;
try {
  config = require(path.join(__dirname, "../config/config"));
} catch (error) {
  console.error("❌ Error loading config:", error.message);
  process.exit(1);
}

require("../models/CommissionRecord");
require("../models/LandlordPayment");
require("../models/LeasePaymentRecord");

const CommissionRecord = require("../models/CommissionRecord");
const LandlordPayment = require("../models/LandlordPayment");
const LeasePaymentRecord = require("../models/LeasePaymentRecord");

async function run() {
  console.log("🧹 Cleaning up duplicate commissions...\n");

  try {
    await mongoose.connect(config.mongodb.uri);
    console.log("✅ Connected to MongoDB\n");

    const all = await CommissionRecord.find({}).sort({ docNumber: 1 }).lean();

    // Group by paymentRecordId
    const byPayment = new Map();
    for (const c of all) {
      const pid = c.paymentRecordId?.toString?.() || c.paymentRecordId;
      if (!byPayment.has(pid)) byPayment.set(pid, []);
      byPayment.get(pid).push(c);
    }

    const duplicates = [...byPayment.entries()].filter(([, list]) => list.length > 1);
    if (duplicates.length === 0) {
      console.log("✅ No duplicate commissions found.");
      return;
    }

    console.log(`Found ${duplicates.length} payment(s) with duplicate commissions:\n`);

    let deletedCommissions = 0;
    let deletedLandlordPayments = 0;

    for (const [paymentRecordId, commissions] of duplicates) {
      // Keep the one with lowest docNumber (first created)
      const sorted = [...commissions].sort((a, b) => (a.docNumber || 0) - (b.docNumber || 0));
      const keep = sorted[0];
      const toDelete = sorted.slice(1);

      console.log(`  Payment ${paymentRecordId}: keeping doc#${keep.docNumber}, removing ${toDelete.length} duplicate(s)`);

      for (const dup of toDelete) {
        // Delete LandlordPayment that references this commission
        const lpResult = await LandlordPayment.deleteMany({ commissionRecordId: dup._id });
        deletedLandlordPayments += lpResult.deletedCount || 0;

        await CommissionRecord.deleteOne({ _id: dup._id });
        deletedCommissions += 1;
      }

      // Ensure LeasePaymentRecord points to the kept commission
      await LeasePaymentRecord.updateOne(
        { _id: paymentRecordId },
        { commissionRecordId: keep._id }
      );
    }

    console.log(`\n📊 Removed ${deletedCommissions} duplicate commission(s), ${deletedLandlordPayments} landlord payment(s)`);
    console.log("✅ Cleanup complete");
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
