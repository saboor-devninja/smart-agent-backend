/**
 * Remove all commission and landlord payment records, then backfill cleanly
 *
 * Usage: node scripts/reset-and-backfill-commissions.js
 */

try {
  require("dotenv").config();
} catch (e) {}

const mongoose = require("mongoose");
const path = require("path");

let config;
try {
  config = require(path.join(__dirname, "../config/config"));
} catch (e) {
  console.error("❌ Error loading config:", e.message);
  process.exit(1);
}

require("../models/CommissionRecord");
require("../models/LandlordPayment");
require("../models/LeasePaymentRecord");
require("../models/Lease");
require("../models/Property");
require("../models/Agency");
require("../models/AutoIncrement");

const CommissionRecord = require("../models/CommissionRecord");
const LandlordPayment = require("../models/LandlordPayment");
const LeasePaymentRecord = require("../models/LeasePaymentRecord");
const CommissionService = require("../api/v1/services/commissionService");

async function run() {
  console.log("🔄 Reset and backfill commissions\n");

  try {
    await mongoose.connect(config.mongodb.uri);
    console.log("✅ Connected to MongoDB\n");

    // 1. Delete all LandlordPayment
    const lpDeleted = await LandlordPayment.deleteMany({});
    console.log(`   Deleted ${lpDeleted.deletedCount} LandlordPayment record(s)`);

    // 2. Delete all CommissionRecord
    const crDeleted = await CommissionRecord.deleteMany({});
    console.log(`   Deleted ${crDeleted.deletedCount} CommissionRecord(s)`);

    // 3. Clear commission links from LeasePaymentRecord
    const lprUpdated = await LeasePaymentRecord.updateMany(
      { $or: [{ commissionRecordId: { $ne: null } }, { landlordPaymentId: { $ne: null } }] },
      { $unset: { commissionRecordId: "", landlordPaymentId: "" } }
    );
    console.log(`   Cleared commission links from ${lprUpdated.modifiedCount} LeasePaymentRecord(s)\n`);

    // 4. Reset AutoIncrement for commission_record_number (optional - keeps doc numbers sequential)
    const AutoIncrement = require("../models/AutoIncrement");
    await AutoIncrement.findOneAndUpdate(
      { name: "commission_record_number" },
      { $set: { seq: 0 } },
      { upsert: true }
    );
    console.log("   Reset commission doc number sequence\n");

    // 5. Backfill
    console.log("📥 Running backfill...\n");
    const result = await CommissionService.backfillMissingCommissions();

    console.log("📊 Result:");
    console.log(`   Created: ${result.created}`);
    console.log(`   Skipped: ${result.skipped}`);
    if (result.errors?.length > 0) {
      console.log(`   Errors: ${result.errors.length}`);
      result.errors.forEach((e) => console.log(`      - ${e.paymentId}: ${e.error}`));
    }
    console.log("\n✅ Done");
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
