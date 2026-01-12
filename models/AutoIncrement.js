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

// name index is automatically created by unique: true

module.exports = mongoose.model("AutoIncrement", autoIncrementSchema);

