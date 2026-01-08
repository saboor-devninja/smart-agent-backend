const mongoose = require("mongoose");
const AutoIncrement = require("./AutoIncrement");

const landlordPaymentSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    docNumber: {
      type: Number,
      unique: true,
    },
    commissionRecordId: {
      type: String,
      ref: "CommissionRecord",
      required: true,
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
    landlordId: {
      type: String,
      ref: "Landlord",
      required: true,
    },
    agentId: {
      type: String,
      ref: "User",
      required: true,
    },
    grossAmount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    netAmount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    adjustments: {
      type: [
        {
          label: String,
          amount: mongoose.Schema.Types.Decimal128,
          type: {
            type: String,
            enum: ["ADDITION", "DEDUCTION"],
          },
        },
      ],
      default: [],
    },
    status: {
      type: String,
      enum: ["PENDING", "PROCESSED", "PAID", "CANCELLED"],
      default: "PENDING",
    },
    paymentMethod: String,
    paymentReference: String,
    paidAt: {
      type: Date,
      default: null,
    },
    bankAccountId: String,
    notes: String,
  },
  {
    timestamps: true,
    _id: false,
  }
);

landlordPaymentSchema.pre("save", async function (next) {
  if (this.isNew && !this.docNumber) {
    const nextSeq = await AutoIncrement.findOneAndUpdate(
      { name: "landlord_payment_number" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.docNumber = nextSeq.seq;
  }
  next();
});

landlordPaymentSchema.index({ landlordId: 1, status: 1 });
landlordPaymentSchema.index({ leaseId: 1 });
landlordPaymentSchema.index({ paymentRecordId: 1 });
landlordPaymentSchema.index({ commissionRecordId: 1 });
landlordPaymentSchema.index({ docNumber: 1 });

module.exports = mongoose.model("LandlordPayment", landlordPaymentSchema);

