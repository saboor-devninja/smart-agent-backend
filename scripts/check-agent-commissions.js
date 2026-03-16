/**
 * Check commissions and platform fees for an agent
 * Usage: node scripts/check-agent-commissions.js outlierequities@outlook.com
 */

try {
  require("dotenv").config();
} catch (e) {}

const mongoose = require("mongoose");
const path = require("path");
const email = process.argv[2] || "outlierequities@outlook.com";

let config;
try {
  config = require(path.join(__dirname, "../config/config"));
} catch (e) {
  console.error("Error loading config");
  process.exit(1);
}

require("../models/User");
require("../models/Lease");
require("../models/LeasePaymentRecord");
require("../models/CommissionRecord");
require("../models/Property");

const User = require("../models/User");
const LeasePaymentRecord = require("../models/LeasePaymentRecord");
const CommissionRecord = require("../models/CommissionRecord");
const Property = require("../models/Property");

function norm(v) {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

async function run() {
  await mongoose.connect(config.mongodb.uri);

  const user = await User.findOne({ email }).lean();
  if (!user) {
    console.log("User not found:", email);
    process.exit(1);
  }

  const agentId = user._id;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

  console.log("\n=== Agent:", user.firstName, user.lastName, `(${email})`);

  // Payments DUE this month, status PAID
  const paymentsDueThisMonth = await LeasePaymentRecord.find({
    agentId,
    type: "RENT",
    status: "PAID",
    dueDate: { $gte: startOfMonth, $lte: endOfMonth },
  })
    .populate("leaseId", "propertyId")
    .lean();

  let collected = 0;
  console.log("\n--- Payments DUE this month (PAID) ---");
  for (const p of paymentsDueThisMonth) {
    const amt = norm(p.amountDue) + (Array.isArray(p.charges) ? p.charges.reduce((s, c) => s + norm(c.amount), 0) : 0);
    collected += amt;
    const prop = await Property.findById(p.leaseId?.propertyId).select("title platformFeePercentage").lean();
    const comm = await CommissionRecord.findOne({ paymentRecordId: p._id }).lean();
    console.log(
      `  ${p.label} | ${amt.toFixed(2)} | paidDate: ${p.paidDate} | commission createdAt: ${comm?.createdAt} | platformFee: ${norm(comm?.platformCommission)} | property: ${prop?.title}`
    );
  }
  console.log("  TOTAL COLLECTED (due this month):", collected.toFixed(2));
  console.log("  2% of collected:", (collected * 0.02).toFixed(2));

  // Commissions CREATED this month (createdAt in March)
  const commissionsThisMonth = await CommissionRecord.find({
    agentId,
    createdAt: { $gte: startOfMonth, $lte: endOfMonth },
  })
    .populate("paymentRecordId", "label amountDue charges paidDate dueDate")
    .populate("propertyId", "title platformFeePercentage")
    .lean();

  let platformFeeSum = 0;
  let paymentAmountSum = 0;
  console.log("\n--- Commissions CREATED this month (createdAt in current month) ---");
  for (const c of commissionsThisMonth) {
    const pf = norm(c.platformCommission);
    const pmt = norm(c.paymentAmount);
    platformFeeSum += pf;
    paymentAmountSum += pmt;
    const payment = c.paymentRecordId;
    console.log(
      `  ${payment?.label} | paymentAmount: ${pmt} | platformCommission: ${pf} | createdAt: ${c.createdAt} | paidDate: ${payment?.paidDate} | property: ${c.propertyId?.title}`
    );
  }
  console.log("  TOTAL platformFeeDue (current month):", platformFeeSum.toFixed(2));
  console.log("  Total paymentAmount in these commissions:", paymentAmountSum.toFixed(2));
  console.log("  2% of paymentAmount:", (paymentAmountSum * 0.02).toFixed(2));

  // Commissions CREATED previous month
  const commissionsPrevMonth = await CommissionRecord.find({
    agentId,
    createdAt: { $gte: startOfPrevMonth, $lte: endOfPrevMonth },
  })
    .populate("paymentRecordId", "label paidDate dueDate")
    .lean();

  let prevPlatformFee = 0;
  console.log("\n--- Commissions CREATED previous month ---");
  for (const c of commissionsPrevMonth) {
    prevPlatformFee += norm(c.platformCommission);
    const payment = c.paymentRecordId;
    console.log(
      `  ${payment?.label} | platformCommission: ${norm(c.platformCommission)} | dueDate: ${payment?.dueDate} | paidDate: ${payment?.paidDate}`
    );
  }
  console.log("  TOTAL platformFeePreviousMonth:", prevPlatformFee.toFixed(2));

  // Check: any payments DUE this month but commission createdAt in PREV month?
  console.log("\n--- Mismatch: March-due payments with commission in previous month ---");
  for (const p of paymentsDueThisMonth) {
    const comm = await CommissionRecord.findOne({ paymentRecordId: p._id }).lean();
    if (comm) {
      const created = new Date(comm.createdAt);
      if (created < startOfMonth) {
        const amt = norm(p.amountDue) + (Array.isArray(p.charges) ? p.charges.reduce((s, c) => s + norm(c.amount), 0) : 0);
        console.log(`  ${p.label} | amount: ${amt} | paidDate: ${p.paidDate} | commission createdAt: ${comm.createdAt} (prev month)`);
      }
    }
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
