const mongoose = require("mongoose");

const tenantSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
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
  },
  {
    timestamps: true,
    _id: false,
  }
);

tenantSchema.index({ agentId: 1 });
tenantSchema.index({ agencyId: 1 });
tenantSchema.index({ email: 1 });

const Tenant = mongoose.model("Tenant", tenantSchema);

module.exports = Tenant;

