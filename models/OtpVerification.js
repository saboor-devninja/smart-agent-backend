const mongoose = require("mongoose");

const otpVerificationSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["EMAIL_VERIFICATION", "PASSWORD_RESET"],
      default: "EMAIL_VERIFICATION",
    },
    otp: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 3,
    },
  },
  {
    timestamps: true,
    _id: false,
  }
);

otpVerificationSchema.index({ email: 1, type: 1 }, { unique: true });
otpVerificationSchema.index({ email: 1, otp: 1 });
otpVerificationSchema.index({ expiresAt: 1 });

otpVerificationSchema.methods.isExpired = function () {
  return new Date() > this.expiresAt;
};

otpVerificationSchema.methods.hasExceededAttempts = function () {
  return this.attempts >= this.maxAttempts;
};

module.exports = mongoose.model("OtpVerification", otpVerificationSchema);
