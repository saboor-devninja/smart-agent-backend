const mongoose = require("mongoose");

const propertyUtilitySchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    propertyId: {
      type: String,
      ref: "Property",
      required: true,
    },
    utilityType: {
      type: String,
      enum: [
        "ELECTRICITY",
        "GAS",
        "WATER",
        "MUNICIPALITY",
        "INTERNET",
        "CABLE_TV",
        "TRASH",
        "SEWER",
        "SECURITY_DEPOSIT",
        "MAINTENANCE",
        "CLEANING",
        "PARKING_FEE",
        "LATE_FEE",
        "OTHER",
      ],
      required: true,
    },
    paymentType: {
      type: String,
      enum: ["PREPAID_BY_TENANT", "POSTPAID_BY_TENANT", "INCLUDED_IN_RENT"],
      required: true,
    },
  },
  {
    timestamps: true,
    _id: false,
  }
);

propertyUtilitySchema.index({ propertyId: 1, utilityType: 1 }, { unique: true });

const PropertyUtility = mongoose.model("PropertyUtility", propertyUtilitySchema);

module.exports = PropertyUtility;

