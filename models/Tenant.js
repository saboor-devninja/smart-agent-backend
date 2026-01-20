const mongoose = require("mongoose");
const AutoIncrement = require("./AutoIncrement");

const tenantSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    docNumber: {
      type: Number,
      unique: true,
    },
    agentId: {
      type: String,
      ref: "User",
      required: true,
    },
    agencyId: {
      type: String,
      ref: "Agency",
      default: null,
    },
    firstName: {
      type: String,
      required: [true, "First name is required"],
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    phoneNumber: String,
    profilePicture: String,
    address: String,
    city: String,
    country: String,
    postalCode: String,
    dateOfBirth: Date,
    idNumber: String,
    idType: {
      type: String,
      enum: ["PASSPORT", "NATIONAL_ID", "DRIVERS_LICENSE", "OTHER"],
    },
    emergencyContactName: String,
    emergencyContactPhone: String,
    emergencyContactRelationship: String,
    notes: String,
    kycStatus: {
      type: String,
      enum: ["PENDING", "VERIFIED", "REJECTED"],
      default: "PENDING",
    },
    kycVerifiedAt: Date,
    kycVerifiedBy: {
      type: String,
      ref: "User",
    },
    kycChecklist: {
      type: [
        {
          item: {
            type: String,
            required: true,
          },
          verified: {
            type: Boolean,
            default: false,
          },
          verifiedAt: Date,
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
    _id: false,
  }
);

tenantSchema.pre("save", async function (next) {
  if (this.isNew && !this.docNumber) {
    const nextSeq = await AutoIncrement.findOneAndUpdate(
      { name: "tenant_number" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.docNumber = nextSeq.seq;
  }
  next();
});

tenantSchema.index({ agentId: 1 });
tenantSchema.index({ agencyId: 1 });
tenantSchema.index({ email: 1 });
// docNumber index is automatically created by unique: true

const Tenant = mongoose.model("Tenant", tenantSchema);

module.exports = Tenant;

