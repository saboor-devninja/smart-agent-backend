const mongoose = require("mongoose");

const leasePrerequisiteSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    leaseId: {
      type: String,
      ref: "Lease",
      required: true,
    },
    agentId: {
      type: String,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "SECURITY_DEPOSIT_PAID",
        "FIRST_MONTH_RENT_PAID",
        "LAST_MONTH_RENT_PAID",
        "DOCUMENTS_SIGNED",
        "BACKGROUND_CHECK_COMPLETED",
        "REFERENCES_VERIFIED",
        "CUSTOM",
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: null,
    },
    isRequired: {
      type: Boolean,
      default: true,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    completedAt: Date,
    completedBy: {
      type: String,
      ref: "User",
      default: null,
    },
    customType: {
      type: String,
      default: null,
    },
    notes: {
      type: String,
      default: null,
    },
    documentUrl: {
      type: String,
      default: null,
    },
    amount: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    priority: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
    _id: false,
  }
);

leasePrerequisiteSchema.index({ leaseId: 1, isRequired: 1 });
leasePrerequisiteSchema.index({ type: 1, isCompleted: 1 });

module.exports = mongoose.model("LeasePrerequisite", leasePrerequisiteSchema);


