const mongoose = require("mongoose");

const propertySchema = new mongoose.Schema(
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
    landlordId: {
      type: String,
      ref: "Landlord",
      required: true,
    },
    agencyId: {
      type: String,
      ref: "Agency",
      default: null,
    },
    type: {
      type: String,
      enum: [
        "APARTMENT",
        "HOUSE",
        "CONDO",
        "TOWNHOUSE",
        "DUPLEX",
        "STUDIO",
        "COMMERCIAL",
        "RETAIL",
        "OTHER",
      ],
      default: "OTHER",
    },
    title: {
      type: String,
      required: [true, "Property title is required"],
    },
    description: String,
    bedrooms: {
      type: Number,
      default: 0,
    },
    bathrooms: {
      type: mongoose.Schema.Types.Decimal128,
      default: "0.0",
    },
    area: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    areaUnit: {
      type: String,
      enum: ["SQ_FT", "SQ_M"],
      default: "SQ_FT",
    },
    yearBuilt: Number,
    furnished: {
      type: Boolean,
      default: false,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    rentAmount: {
      type: mongoose.Schema.Types.Decimal128,
    },
    rentalCycle: {
      type: String,
      enum: ["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"],
      default: "MONTHLY",
    },
    securityDeposit: {
      type: mongoose.Schema.Types.Decimal128,
    },
    minimumLease: Number,
    maximumLease: Number,
    petPolicy: String,
    petsAllowed: {
      type: Boolean,
      default: false,
    },
    smokingAllowed: {
      type: Boolean,
      default: false,
    },
    maxOccupants: Number,
    parking: {
      type: Boolean,
      default: false,
    },
    parkingSpaces: {
      type: Number,
      default: 0,
    },
    amenities: String,
    availableFrom: {
      type: Date,
      get: function(value) {
        if (!value) return value;
        return value;
      },
      set: function(value) {
        if (!value) return value;
        if (typeof value === 'string') {
          const date = new Date(value);
          return isNaN(date.getTime()) ? value : date;
        }
        return value;
      },
    },
    commissionType: {
      type: String,
      enum: ["PERCENTAGE", "FIXED_AMOUNT"],
    },
    commissionPercentage: {
      type: mongoose.Schema.Types.Decimal128,
    },
    commissionFixedAmount: {
      type: mongoose.Schema.Types.Decimal128,
    },
    commissionFrequency: {
      type: String,
      enum: ["WEEKLY", "MONTHLY", "BI_MONTHLY", "QUARTERLY", "SEMI_ANNUALLY", "YEARLY", "ONE_TIME", "PER_LEASE"],
    },
    commissionNotes: String,
    platformFeePercentage: {
      type: mongoose.Schema.Types.Decimal128,
      default: "20.00",
    },
    address: {
      type: String,
      required: [true, "Address is required"],
    },
    city: String,
    state: String,
    zipCode: String,
    country: String,
    latitude: {
      type: mongoose.Schema.Types.Decimal128,
    },
    longitude: {
      type: mongoose.Schema.Types.Decimal128,
    },
  },
  {
    timestamps: true,
    _id: false,
  }
);

propertySchema.index({ agencyId: 1, isAvailable: 1 });
propertySchema.index({ city: 1, state: 1 });
propertySchema.index({ agentId: 1 });
propertySchema.index({ landlordId: 1 });

const Property = mongoose.model("Property", propertySchema);

module.exports = Property;

