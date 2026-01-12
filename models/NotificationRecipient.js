const mongoose = require("mongoose");

const notificationRecipientSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    notificationId: {
      type: String,
      ref: "Notification",
      required: true,
    },
    userId: {
      type: String,
      ref: "User",
      required: true,
    },
    channel: {
      type: String,
      enum: ["IN_APP", "EMAIL", "SMS"],
      default: "IN_APP",
    },
    readAt: {
      type: Date,
      default: null,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    deliveryStatus: {
      type: String,
      enum: ["PENDING", "SENT", "DELIVERED", "FAILED"],
      default: "PENDING",
    },
    deliveryError: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    _id: false,
  }
);

// Indexes for efficient queries
notificationRecipientSchema.index({ notificationId: 1 });
notificationRecipientSchema.index({ userId: 1, readAt: 1 });
notificationRecipientSchema.index({ userId: 1, archivedAt: 1 });
notificationRecipientSchema.index({ userId: 1, createdAt: -1 });
notificationRecipientSchema.index({ userId: 1, channel: 1, deliveryStatus: 1 });
// Compound index for common queries
notificationRecipientSchema.index({ userId: 1, archivedAt: 1, readAt: 1, createdAt: -1 });

const NotificationRecipient = mongoose.model("NotificationRecipient", notificationRecipientSchema);

module.exports = NotificationRecipient;
