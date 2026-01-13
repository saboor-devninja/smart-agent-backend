const mongoose = require("mongoose");

const emailIdentitySchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    userId: {
      type: String,
      ref: "User",
      required: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    displayName: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["AGENT", "AGENCY_ADMIN", "PLATFORM_ADMIN"],
      required: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    _id: false,
  }
);

emailIdentitySchema.index({ userId: 1 });
emailIdentitySchema.index({ email: 1 }, { unique: true });
emailIdentitySchema.index({ isDefault: 1 });

module.exports = mongoose.model("EmailIdentity", emailIdentitySchema);
