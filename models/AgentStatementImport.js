const mongoose = require("mongoose");

const AgentStatementImportSchema = new mongoose.Schema(
  {
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
    originalFileName: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING_MAPPING", "PENDING_REVIEW", "PARTIAL", "COMPLETED", "CANCELLED"],
      default: "PENDING_MAPPING",
      index: true,
    },
    // Optional statement period hint (e.g. from file or user input)
    periodMonth: {
      type: Number,
      min: 1,
      max: 12,
      default: null,
    },
    periodYear: {
      type: Number,
      min: 1970,
      max: 2100,
      default: null,
    },
    totalRows: {
      type: Number,
      default: 0,
    },
    matchedRows: {
      type: Number,
      default: 0,
    },
    unmatchedRows: {
      type: Number,
      default: 0,
    },
    appliedRows: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("AgentStatementImport", AgentStatementImportSchema);

