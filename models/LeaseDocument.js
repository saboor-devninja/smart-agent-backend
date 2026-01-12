const mongoose = require("mongoose");
const AutoIncrement = require("./AutoIncrement");

const leaseDocumentSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    docNumber: {
      type: Number,
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
    documentName: {
      type: String,
      required: true,
    },
    documentType: {
      type: String,
      enum: [
        "lease_agreement",
        "addendum",
        "amendment",
        "inspection_report",
        "rental_application",
        "other",
      ],
      default: "lease_agreement",
    },
    fileUrl: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      default: null,
    },
    mimeType: {
      type: String,
      default: null,
    },
    notes: {
      type: String,
      default: null,
    },
    docusignEnvelopeId: {
      type: String,
      ref: "DocuSignEnvelope",
      default: null,
    },
    isForSignature: {
      type: Boolean,
      default: false,
    },
    signedAt: Date,
    signedDocumentUrl: String,
  },
  {
    timestamps: true,
    _id: false,
  }
);

leaseDocumentSchema.pre("save", async function (next) {
  if (this.isNew && !this.docNumber) {
    const nextSeq = await AutoIncrement.findOneAndUpdate(
      { name: "lease_document_number" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.docNumber = nextSeq.seq;
  }
  next();
});

leaseDocumentSchema.index({ leaseId: 1 });
leaseDocumentSchema.index({ agentId: 1 });
leaseDocumentSchema.index({ docusignEnvelopeId: 1 });
// docNumber index is automatically created by unique: true

module.exports = mongoose.model("LeaseDocument", leaseDocumentSchema);

