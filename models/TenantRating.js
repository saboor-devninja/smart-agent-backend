const mongoose = require("mongoose");

const tenantRatingSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    tenantId: {
      type: String,
      ref: "Tenant",
      required: true,
    },
    agentId: {
      type: String,
      ref: "User",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: String,
  },
  {
    timestamps: true,
    _id: false,
  }
);

tenantRatingSchema.index({ tenantId: 1, agentId: 1 }, { unique: true });

const TenantRating = mongoose.model("TenantRating", tenantRatingSchema);

module.exports = TenantRating;

