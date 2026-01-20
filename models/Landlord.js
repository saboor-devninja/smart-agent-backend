const mongoose = require("mongoose");
const AutoIncrement = require("./AutoIncrement");

const landlordSchema = new mongoose.Schema(
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
    isOrganization: {
      type: Boolean,
      default: false,
    },
    organizationName: String,
    organizationType: String,
    firstName: String,
    lastName: String,
    contactPersonName: {
      type: String,
      required: [true, "Contact person name is required"],
    },
    contactPersonEmail: {
      type: String,
      required: [true, "Contact person email is required"],
      lowercase: true,
      trim: true,
    },
    contactPersonPhone: {
      type: String,
      required: [true, "Contact person phone is required"],
    },
    contactPersonProfilePicture: String,
    vatNumber: String,
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
    assignedAt: Date,
    assignedBy: {
      type: String,
      ref: "User",
    },
    bankAccount: {
      accountHolderName: {
        type: String,
        default: "Not Set",
      },
      bankName: String,
      accountNumber: String,
      branchName: String,
      branchCode: String,
      iban: String,
      swiftCode: String,
    },
  },
  {
    timestamps: true,
    _id: false,
  }
);

landlordSchema.pre("save", async function (next) {
  if (this.isNew && !this.docNumber) {
    const nextSeq = await AutoIncrement.findOneAndUpdate(
      { name: "landlord_number" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.docNumber = nextSeq.seq;
  }
  next();
});

landlordSchema.index({ agentId: 1 });
landlordSchema.index({ agencyId: 1 });
landlordSchema.index({ email: 1 });
// docNumber index is automatically created by unique: true

const Landlord = mongoose.model("Landlord", landlordSchema);

module.exports = Landlord;

