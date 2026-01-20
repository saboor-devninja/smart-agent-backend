const mongoose = require("mongoose");
const AutoIncrement = require("./AutoIncrement");

const sentEmailSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    docNumber: {
      type: Number,
      unique: true,
    },
    subject: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    htmlBody: {
      type: String,
    },
    senderId: {
      type: String,
      ref: "User",
      required: true,
    },
    fromEmailIdentityId: {
      type: String,
      ref: "EmailIdentity",
    },
    recipients: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    threadId: {
      type: String,
    },
    attachments: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
    },
    status: {
      type: String,
      enum: ["PENDING", "SENT", "FAILED"],
      default: "PENDING",
    },
    sentAt: {
      type: Date,
    },
    error: {
      type: String,
    },
    isKyc: {
      type: Boolean,
      default: false,
    },
    tenantId: {
      type: String,
      ref: "Tenant",
    },
    landlordId: {
      type: String,
      ref: "Landlord",
    },
    kycStatus: {
      type: String,
      enum: ["PENDING", "VERIFIED", "REJECTED"],
    },
    kycChecks: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
    },
    receivedDocuments: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
    },
    resendEmailId: {
      type: String,
    },
    replyToEmail: {
      type: String,
    },
    messageId: {
      type: String,
    },
    isInbound: {
      type: Boolean,
      default: false,
    },
    inboundFromEmail: {
      type: String,
    },
    inboundFromName: {
      type: String,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    _id: false,
  }
);

sentEmailSchema.pre("save", async function (next) {
  if (this.isNew && !this.docNumber) {
    const nextSeq = await AutoIncrement.findOneAndUpdate(
      { name: "sent_email_number" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.docNumber = nextSeq.seq;
  }
  next();
});

sentEmailSchema.index({ senderId: 1, createdAt: -1 });
// Compound index for inbox queries: senderId + isKyc + tenantId
sentEmailSchema.index({ senderId: 1, isKyc: 1, tenantId: 1 });
sentEmailSchema.index({ tenantId: 1 });
sentEmailSchema.index({ landlordId: 1 });
sentEmailSchema.index({ status: 1 });
sentEmailSchema.index({ isKyc: 1 });
sentEmailSchema.index({ threadId: 1 });
sentEmailSchema.index({ fromEmailIdentityId: 1 });
// docNumber index is automatically created by unique: true

// Virtual for replies
sentEmailSchema.virtual("replies", {
  ref: "EmailReply",
  localField: "_id",
  foreignField: "sentEmailId",
});

// Ensure virtuals are included in JSON output
sentEmailSchema.set("toJSON", { virtuals: true });
sentEmailSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("SentEmail", sentEmailSchema);
