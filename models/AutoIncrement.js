const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const autoIncrementSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  seq: {
    type: Number,
    default: 0,
  },
});

autoIncrementSchema.index({ name: 1 });

module.exports = mongoose.model("AutoIncrement", autoIncrementSchema);

