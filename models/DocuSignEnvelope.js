const mongoose = require("mongoose");

const docuSignEnvelopeSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    docNumber: {
      type: Number,
      unique: true,
    },
    envelopeId: {
      type: String,
      required: true,
      unique: true,
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
    agencyId: {
      type: String,
      ref: "Agency",
      default: null,
    },
    emailSubject: {
      type: String,
      default: "Lease agreement for signature",
    },
    status: {
      type: String,
      enum: ["SENT", "DELIVERED", "COMPLETED", "DECLINED", "VOIDED", "SIGNING_COMPLETE"],
      default: "SENT",
    },
    recipients: {
      type: [
        {
          email: String,
          name: String,
          role: { type: String, enum: ["landlord", "tenant"] },
          status: String,
          signedAt: Date,
        },
      ],
      default: [],
    },
    documentCount: {
      type: Number,
      default: 0,
    },
    documentNames: {
      type: [String],
      default: [],
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    notes: {
      type: String,
      default: null,
    },
    completedAt: Date,
    voidedAt: Date,
    voidedReason: String,
    signedDocumentUrl: String,
    statusChangedAt: Date,
    lastWebhookAt: Date,
  },
  {
    timestamps: true,
    _id: false,
  }
);

docuSignEnvelopeSchema.index({ leaseId: 1 });
docuSignEnvelopeSchema.pre("save", async function (next) {
  if (this.isNew && !this.docNumber) {
    const nextSeq = await AutoIncrement.findOneAndUpdate(
      { name: "docusign_envelope_number" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.docNumber = nextSeq.seq;
  }
  next();
});

docuSignEnvelopeSchema.index({ agentId: 1 });
docuSignEnvelopeSchema.index({ status: 1 });
// docNumber index is automatically created by unique: true

module.exports = mongoose.model("DocuSignEnvelope", docuSignEnvelopeSchema);

