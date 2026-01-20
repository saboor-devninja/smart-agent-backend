const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const AutoIncrement = require("./AutoIncrement");

const userSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    docNumber: {
      type: Number,
      unique: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false,
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
    },
    phone: {
      type: String,
      default: null,
      trim: true,
    },
    city: {
      type: String,
      default: null,
      trim: true,
    },
    country: {
      type: String,
      default: null,
      trim: true,
    },
    profilePicture: {
      type: String,
      default: null,
    },
    companyName: {
      type: String,
      default: null,
      trim: true,
    },
    companyRegistration: {
      type: String,
      default: null,
      trim: true,
    },
    companyAddress: {
      type: String,
      default: null,
      trim: true,
    },
    companyWebsite: {
      type: String,
      default: null,
      trim: true,
    },
    companyLogo: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      enum: ['PLATFORM_ADMIN', 'AGENCY_ADMIN', 'MODERATOR', 'AGENT'],
      default: 'AGENT',
    },
    agencyId: {
      type: String,
      ref: 'Agency',
      default: null,
    },
    isIndependent: {
      type: Boolean,
      default: false,
    },
    currency: {
      type: String,
      default: 'USD',
    },
    currencySymbol: {
      type: String,
      default: '$',
    },
    currencyLocale: {
      type: String,
      default: 'en-US',
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerifiedAt: Date,
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    _id: false,
  }
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ agencyId: 1, role: 1 });
userSchema.index({ isIndependent: 1 });

userSchema.pre('save', async function (next) {
  if (this.isNew && !this.docNumber) {
    const nextSeq = await AutoIncrement.findOneAndUpdate(
      { name: "user_number" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.docNumber = nextSeq.seq;
  }
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model("User", userSchema);

module.exports = User;

