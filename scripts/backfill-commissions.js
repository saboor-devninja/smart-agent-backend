/**
 * Backfill missing commission records for paid rent payments
 *
 * Usage: node scripts/backfill-commissions.js
 */

try {
  require("dotenv").config();
} catch (error) {
  console.warn("⚠️  dotenv not available, using environment variables directly");
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

// Load models
require("../models/CommissionRecord");
require("../models/LandlordPayment");
require("../models/LeasePaymentRecord");
require("../models/Lease");
require("../models/Property");
require("../models/Agency");
require("../models/AutoIncrement");

const CommissionService = require("../api/v1/services/commissionService");

async function run() {
  console.log("🔄 Starting commission backfill...\n");

  try {
    await mongoose.connect(config.mongodb.uri);
    console.log("✅ Connected to MongoDB\n");

    const result = await CommissionService.backfillMissingCommissions();

    console.log("📊 Result:");
    console.log(`   Created: ${result.created}`);
    console.log(`   Skipped (already had commission): ${result.skipped}`);
    if (result.errors?.length > 0) {
      console.log(`   Errors: ${result.errors.length}`);
      result.errors.forEach((e) => console.log(`      - ${e.paymentId}: ${e.error}`));
    }
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
