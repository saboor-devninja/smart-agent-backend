const mongoose = require("mongoose");
const AutoIncrement = require("./AutoIncrement");

const agencySchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    docNumber: {
      type: Number,
      unique: true,
    },
    name: {
      type: String,
      required: [true, "Agency name is required"],
      maxlength: [100, "Agency name cannot exceed 100 characters"],
    },
    registrationNumber: {
      type: String,
      maxlength: [50, "Registration number cannot exceed 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    phone: String,
    website: String,
    logo: String,
    address: String,
    city: String,
    country: String,
    postalCode: String,
    status: {
      type: String,
      enum: ["ACTIVE", "SUSPENDED", "INACTIVE"],
      default: "ACTIVE",
    },
    defaultCurrency: {
      type: String,
      default: "USD",
    },
    defaultCurrencySymbol: {
      type: String,
      default: "$",
    },
    defaultCurrencyLocale: {
      type: String,
      default: "en-US",
    },
    platformCommissionType: {
      type: String,
      enum: ["PERCENTAGE", "FIXED"],
      default: "PERCENTAGE",
    },
    platformCommissionRate: {
      type: mongoose.Schema.Types.Decimal128,
      default: "20.00",
    },
    platformCommissionFixed: {
      type: mongoose.Schema.Types.Decimal128,
    },
    agencyPlatformCommissionType: {
      type: String,
      enum: ["PERCENTAGE", "FIXED"],
      default: "PERCENTAGE",
    },
    agencyPlatformCommissionRate: {
      type: mongoose.Schema.Types.Decimal128,
      default: "15.00",
    },
    agencyPlatformCommissionFixed: {
      type: mongoose.Schema.Types.Decimal128,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerifiedAt: Date,
  },
  {
    timestamps: true,
    _id: false,
  }
);

agencySchema.pre("save", async function (next) {
  if (this.isNew && !this.docNumber) {
    const nextSeq = await AutoIncrement.findOneAndUpdate(
      { name: "agency_number" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.docNumber = nextSeq.seq;
  }
  next();
});

agencySchema.index({ status: 1 });
agencySchema.index({ email: 1 }, { unique: true });
// docNumber index is automatically created by unique: true

const Agency = mongoose.model("Agency", agencySchema);

module.exports = Agency;

