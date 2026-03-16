/**
 * Backfill platformFeeAmount for existing LeasePaymentRecords
 * - If CommissionRecord exists: use platformCommission
 * - Else: calculate using CommissionService.calculatePlatformFeeOnly
 *
 * Usage: node scripts/backfill-platform-fee.js
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

const LeasePaymentRecord = require("../models/LeasePaymentRecord");
const CommissionRecord = require("../models/CommissionRecord");
const CommissionService = require("../api/v1/services/commissionService");

async function run() {
  console.log("🔄 Backfilling platformFeeAmount on LeasePaymentRecords\n");

  try {
    await mongoose.connect(config.mongodb.uri);
    console.log("✅ Connected to MongoDB\n");

    const records = await LeasePaymentRecord.find({ type: "RENT" }).lean();
    console.log(`   Found ${records.length} RENT payment records\n`);

    let fromCommission = 0;
    let calculated = 0;
    let errors = 0;

    for (const record of records) {
      try {
        let platformFee = 0;

        const commission = await CommissionRecord.findOne({
          paymentRecordId: record._id,
        }).lean();

        if (commission && commission.platformCommission != null) {
          platformFee = Number(commission.platformCommission) || 0;
          fromCommission++;
        } else {
          platformFee = await CommissionService.calculatePlatformFeeOnly(record);
          calculated++;
        }

        await LeasePaymentRecord.updateOne(
          { _id: record._id },
          { $set: { platformFeeAmount: platformFee } }
        );

        if ((fromCommission + calculated + errors) % 100 === 0 && records.length > 100) {
          console.log(`   Processed ${fromCommission + calculated + errors}/${records.length}...`);
        }
      } catch (err) {
        errors++;
        console.error(`   Error for ${record._id}:`, err.message);
      }
    }

    console.log("\n📊 Result:");
    console.log(`   From CommissionRecord: ${fromCommission}`);
    console.log(`   Calculated: ${calculated}`);
    console.log(`   Errors: ${errors}`);
    console.log("\n✅ Backfill complete");
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
