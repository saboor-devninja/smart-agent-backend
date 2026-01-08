const mongoose = require("mongoose");

const leasePaymentRecordSchema = new mongoose.Schema(
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
      enum: ["RENT", "SECURITY_DEPOSIT", "FEE", "OTHER"],
      required: true,
    },
    label: {
      type: String,
      required: true,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    amountDue: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "SENT", "PARTIALLY_PAID", "PAID", "CANCELLED"],
      default: "PENDING",
    },
    amountPaid: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
    },
    paidDate: {
      type: Date,
      default: null,
    },
    paymentMethod: {
      type: String,
      default: null,
    },
    paymentReference: {
      type: String,
      default: null,
    },
    invoiceUrl: {
      type: String,
      default: null,
    },
    receiptUrl: {
      type: String,
      default: null,
    },
    notes: {
      type: String,
      default: null,
    },
    charges: {
      type: [
        {
          label: String,
          amount: mongoose.Schema.Types.Decimal128,
        },
      ],
      default: [],
    },
    isFirstMonthRent: {
      type: Boolean,
      default: false,
    },
    isSecurityDeposit: {
      type: Boolean,
      default: false,
    },
    commissionRecordId: {
      type: String,
      ref: "CommissionRecord",
      default: null,
    },
    landlordPaymentId: {
      type: String,
      ref: "LandlordPayment",
      default: null,
    },
  },
  {
    timestamps: true,
    _id: false,
  }
);

leasePaymentRecordSchema.index({ leaseId: 1, dueDate: 1 });
leasePaymentRecordSchema.index({ leaseId: 1, status: 1 });
leasePaymentRecordSchema.index({ commissionRecordId: 1 });
leasePaymentRecordSchema.index({ landlordPaymentId: 1 });

module.exports = mongoose.model("LeasePaymentRecord", leasePaymentRecordSchema);


