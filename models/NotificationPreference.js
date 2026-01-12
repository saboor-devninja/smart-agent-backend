const mongoose = require("mongoose");

const notificationPreferenceSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    userId: {
      type: String,
      ref: "User",
      required: true,
      unique: true,
    },
    inAppEnabled: {
      type: Boolean,
      default: true,
    },
    emailEnabled: {
      type: Boolean,
      default: false,
    },
    smsEnabled: {
      type: Boolean,
      default: false,
    },
    popupEnabled: {
      type: Boolean,
      default: false,
    },
    quietStartHr: {
      type: Number,
      default: null,
      min: 0,
      max: 23,
    },
    quietEndHr: {
      type: Number,
      default: null,
      min: 0,
      max: 23,
    },
    mutedTypes: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    _id: false,
  }
);

// userId index is automatically created by unique: true in the schema

const NotificationPreference = mongoose.model(
  "NotificationPreference",
  notificationPreferenceSchema
);

module.exports = NotificationPreference;

