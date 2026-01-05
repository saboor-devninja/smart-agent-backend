const mongoose = require("mongoose");

const propertyMediaSchema = new mongoose.Schema(
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
    type: {
      type: String,
      enum: ["IMAGE", "VIDEO", "AUDIO", "PDF", "DOCUMENT"],
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    fileName: String,
    fileSize: Number,
    description: String,
  },
  {
    timestamps: true,
    _id: false,
  }
);

propertyMediaSchema.index({ propertyId: 1 });

const PropertyMedia = mongoose.model("PropertyMedia", propertyMediaSchema);

module.exports = PropertyMedia;

