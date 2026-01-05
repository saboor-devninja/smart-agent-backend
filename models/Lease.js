const mongoose = require("mongoose");

const leaseSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    propertyId: {
      type: String,
      ref: "Property",
      required: true,
    },
    tenantId: {
      type: String,
      ref: "Tenant",
      required: true,
    },
    agentId: {
      type: String,
      ref: "User",
      required: true,
    },
    landlordId: {
      type: String,
      ref: "Landlord",
      required: true,
    },
    agencyId: {
      type: String,
      ref: "Agency",
      default: null,
    },
    leaseNumber: {
      type: String,
      required: true,
    },
    rentAmount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    rentFrequency: {
      type: String,
      enum: ["MONTHLY", "QUARTERLY", "YEARLY"],
      default: "MONTHLY",
    },
    dueDay: {
      type: Number,
      min: 1,
      max: 31,
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: Date,
    leaseDuration: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["DRAFT", "PENDING_START", "ACTIVE", "TERMINATED", "CANCELLED"],
      default: "DRAFT",
    },
    actualStartDate: Date,
    canStartReason: String,
    readyToStart: {
      type: Boolean,
      default: false,
    },
    startedBy: {
      type: String,
      ref: "User",
    },
    startedAt: Date,
    securityDeposit: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    lateFeeEnabled: {
      type: Boolean,
      default: false,
    },
    lateFeeType: {
      type: String,
      enum: ["FIXED_AMOUNT", "PERCENTAGE", "DAILY_RATE"],
      default: "FIXED_AMOUNT",
    },
    lateFee: {
      type: mongoose.Schema.Types.Decimal128,
    },
    lateFeePercentage: {
      type: mongoose.Schema.Types.Decimal128,
    },
    lateFeeDays: {
      type: Number,
      default: 5,
    },
    petDeposit: {
      type: mongoose.Schema.Types.Decimal128,
    },
    autoRenewal: {
      type: Boolean,
      default: false,
    },
    renewalNotice: {
      type: Number,
      default: 30,
    },
    terminationNotice: {
      type: Number,
      default: 30,
    },
    earlyTerminationFee: {
      type: mongoose.Schema.Types.Decimal128,
    },
    signedAt: {
      type: Date,
      required: true,
    },
    witnessName: String,
    notes: String,
    inspectionNotes: String,
    platformCommissionOverride: {
      type: Boolean,
      default: false,
    },
    platformCommissionType: {
      type: String,
      enum: ["PERCENTAGE", "FIXED"],
    },
    platformCommissionRate: {
      type: mongoose.Schema.Types.Decimal128,
    },
    platformCommissionFixed: {
      type: mongoose.Schema.Types.Decimal128,
    },
    agencyCommissionEnabled: {
      type: Boolean,
      default: false,
    },
    agencyCommissionType: {
      type: String,
      enum: ["PERCENTAGE", "FIXED"],
    },
    agencyCommissionRate: {
      type: mongoose.Schema.Types.Decimal128,
    },
    agencyCommissionFixed: {
      type: mongoose.Schema.Types.Decimal128,
    },
  },
  {
    timestamps: true,
    _id: false,
  }
);

leaseSchema.index({ agencyId: 1, status: 1 });
leaseSchema.index({ tenantId: 1, propertyId: 1 });
leaseSchema.index({ leaseNumber: 1 }, { unique: true });
leaseSchema.index({ status: 1 });
leaseSchema.index({ propertyId: 1 });

const Lease = mongoose.model("Lease", leaseSchema);

module.exports = Lease;

