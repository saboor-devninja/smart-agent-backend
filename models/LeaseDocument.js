const mongoose = require("mongoose");

const leaseDocumentSchema = new mongoose.Schema(
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

leaseDocumentSchema.index({ leaseId: 1 });
leaseDocumentSchema.index({ agentId: 1 });
leaseDocumentSchema.index({ docusignEnvelopeId: 1 });

module.exports = mongoose.model("LeaseDocument", leaseDocumentSchema);

