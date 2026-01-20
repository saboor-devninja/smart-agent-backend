const mongoose = require("mongoose");
const AutoIncrement = require("./AutoIncrement");

const emailReplySchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    docNumber: {
      type: Number,
      unique: true,
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

emailReplySchema.pre("save", async function (next) {
  if (this.isNew && !this.docNumber) {
    const nextSeq = await AutoIncrement.findOneAndUpdate(
      { name: "email_reply_number" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.docNumber = nextSeq.seq;
  }
  next();
});

emailReplySchema.index({ sentEmailId: 1, createdAt: -1 });
emailReplySchema.index({ fromEmail: 1 });
emailReplySchema.index({ threadId: 1 });
// docNumber index is automatically created by unique: true

module.exports = mongoose.model("EmailReply", emailReplySchema);
