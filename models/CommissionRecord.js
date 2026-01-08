const mongoose = require("mongoose");

const commissionRecordSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    paymentRecordId: {
      type: String,
      ref: "LeasePaymentRecord",
      required: true,
    },
    leaseId: {
      type: String,
      ref: "Lease",
      required: true,
    },
    propertyId: {
      type: String,
      ref: "Property",
      required: true,
    },
    agentId: {
      type: String,
      ref: "User",
      required: true,
    },
    agencyId: {
      type: String,
      ref: "Agency",
      default: null,
    },
    landlordId: {
      type: String,
      ref: "Landlord",
      required: true,
    },
    paymentAmount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    agentGrossCommission: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    agentPlatformFee: {
      type: mongoose.Schema.Types.Decimal128,
      default: "0.00",
    },
    agentNetCommission: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    agencyCommissionEnabled: {
      type: Boolean,
      default: false,
    },
    agencyGrossCommission: {
      type: mongoose.Schema.Types.Decimal128,
      default: "0.00",
    },
    agencyPlatformFee: {
      type: mongoose.Schema.Types.Decimal128,
      default: "0.00",
    },
    agencyNetCommission: {
      type: mongoose.Schema.Types.Decimal128,
      default: "0.00",
    },
    platformCommission: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    landlordNetAmount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    // Issue 12: Store commission settings for historical accuracy
    commissionSettings: {
      propertyCommissionType: String,
      propertyCommissionPercentage: mongoose.Schema.Types.Decimal128,
      propertyCommissionFixedAmount: mongoose.Schema.Types.Decimal128,
      propertyPlatformFeePercentage: mongoose.Schema.Types.Decimal128,
      agencyPlatformCommissionType: String,
      agencyPlatformCommissionRate: mongoose.Schema.Types.Decimal128,
      agencyPlatformCommissionFixed: mongoose.Schema.Types.Decimal128,
      leaseAgencyCommissionType: String,
      leaseAgencyCommissionRate: mongoose.Schema.Types.Decimal128,
      leaseAgencyCommissionFixed: mongoose.Schema.Types.Decimal128,
    },
    status: {
      type: String,
      enum: ["PENDING", "PAID", "CANCELLED"],
      default: "PENDING",
    },
    paidAt: {
      type: Date,
      default: null,
    },
    notes: String,
  },
  {
    timestamps: true,
    _id: false,
  }
);

commissionRecordSchema.index({ agentId: 1, status: 1 });
commissionRecordSchema.index({ agencyId: 1, status: 1 });
commissionRecordSchema.index({ leaseId: 1 });
commissionRecordSchema.index({ paymentRecordId: 1 });

module.exports = mongoose.model("CommissionRecord", commissionRecordSchema);

