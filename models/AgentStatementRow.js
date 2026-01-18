const mongoose = require("mongoose");

const AgentStatementRowSchema = new mongoose.Schema(
  {
    importId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AgentStatementImport",
      required: true,
      index: true,
    },
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    agencyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agency",
      default: null,
      index: true,
    },
    // Raw data from file
    rawTenantName: {
      type: String,
      required: true,
      trim: true,
    },
    transactionDate: {
      type: Date,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    periodMonth: {
      type: Number,
      min: 1,
      max: 12,
      required: true,
    },
    periodYear: {
      type: Number,
      min: 1970,
      max: 2100,
      required: true,
    },
    bankReference: {
      type: String,
      default: null,
      trim: true,
    },
    // Matching / mapping fields
    suggestedTenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      default: null,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tenant",
      default: null,
      index: true,
    },
    leaseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lease",
      default: null,
      index: true,
    },
    // Reconciliation status for this row
    status: {
      type: String,
      enum: ["PENDING_MAPPING", "READY", "APPLIED", "IGNORED", "DUPLICATE"],
      default: "PENDING_MAPPING",
      index: true,
    },
    duplicateHash: {
      type: String,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("AgentStatementRow", AgentStatementRowSchema);

