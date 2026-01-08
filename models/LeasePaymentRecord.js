const mongoose = require("mongoose");
const AutoIncrement = require("./AutoIncrement");

const leasePaymentRecordSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    invoiceNumber: {
      type: Number,
      default: null,
    },
    receiptNumber: {
      type: Number,
      default: null,
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

leasePaymentRecordSchema.pre("save", async function (next) {
  if (this.isNew) {
    if (!this.invoiceNumber) {
      const nextSeq = await AutoIncrement.findOneAndUpdate(
        { name: "invoice_number" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      this.invoiceNumber = nextSeq.seq;
    }
  }
  if (this.isModified("status") && this.status === "PAID" && !this.receiptNumber) {
    const nextSeq = await AutoIncrement.findOneAndUpdate(
      { name: "receipt_number" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.receiptNumber = nextSeq.seq;
  }
  next();
});

leasePaymentRecordSchema.index({ leaseId: 1, dueDate: 1 });
leasePaymentRecordSchema.index({ leaseId: 1, status: 1 });
leasePaymentRecordSchema.index({ commissionRecordId: 1 });
leasePaymentRecordSchema.index({ landlordPaymentId: 1 });
leasePaymentRecordSchema.index({ invoiceNumber: 1 });
leasePaymentRecordSchema.index({ receiptNumber: 1 });

module.exports = mongoose.model("LeasePaymentRecord", leasePaymentRecordSchema);


