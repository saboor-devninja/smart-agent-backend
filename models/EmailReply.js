const mongoose = require("mongoose");

const emailReplySchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    sentEmailId: {
      type: String,
      ref: "SentEmail",
      required: true,
    },
    threadId: {
      type: String,
    },
    fromEmail: {
      type: String,
      required: true,
    },
    fromName: {
      type: String,
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
    attachments: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
    },
    resendMessageId: {
      type: String,
    },
    inReplyTo: {
      type: String,
    },
    references: {
      type: String,
    },
  },
  {
    timestamps: true,
    _id: false,
  }
);

emailReplySchema.index({ sentEmailId: 1, createdAt: -1 });
emailReplySchema.index({ fromEmail: 1 });
emailReplySchema.index({ threadId: 1 });

module.exports = mongoose.model("EmailReply", emailReplySchema);
