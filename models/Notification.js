const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString(),
    },
    type: {
      type: String,
      required: true,
      enum: [
        "PROPERTY_CREATED",
        "PROPERTY_UPDATED",
        "PROPERTY_DELETED",
        "PROPERTY_STATUS_CHANGED",
        "PROPERTY_VACANT",
        "LEASE_CREATED",
        "LEASE_STARTED",
        "LEASE_ENDING_SOON",
        "LEASE_TERMINATED",
        "LEASE_RENEWED",
        "LEASE_CANCELLED",
        "LEASE_PREREQUISITE_COMPLETED",
        "RENT_DUE",
        "RENT_OVERDUE",
        "RENT_PAID",
        "RENT_PARTIALLY_PAID",
        "COMMISSION_CREATED",
        "COMMISSION_UPDATED",
        "COMMISSION_PAID",
        "DOCUMENT_SENT",
        "DOCUMENT_SIGNED",
        "DOCUMENT_COMPLETED",
        "DOCUMENT_EXPIRED",
        "DOCUMENT_REJECTED",
        "SYSTEM_ALERT",
        "SYSTEM_UPDATE",
        "SYSTEM_MAINTENANCE",
        "ADMIN_NOTIFICATION",
      ],
    },
    title: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    priority: {
      type: String,
      enum: ["LOW", "NORMAL", "HIGH", "URGENT"],
      default: "NORMAL",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    actorId: {
      type: String,
      ref: "User",
      default: null,
    },
    scheduledAt: {
      type: Date,
      default: null,
    },
    // Related entity IDs for quick lookups
    propertyId: {
      type: String,
      ref: "Property",
      default: null,
    },
    leaseId: {
      type: String,
      ref: "Lease",
      default: null,
    },
    tenantId: {
      type: String,
      ref: "Tenant",
      default: null,
    },
    landlordId: {
      type: String,
      ref: "Landlord",
      default: null,
    },
    paymentRecordId: {
      type: String,
      ref: "LeasePaymentRecord",
      default: null,
    },
    commissionRecordId: {
      type: String,
      ref: "CommissionRecord",
      default: null,
    },
  },
  {
    timestamps: true,
    _id: false,
  }
);

// Indexes for efficient queries
notificationSchema.index({ type: 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ propertyId: 1 });
notificationSchema.index({ leaseId: 1 });
notificationSchema.index({ paymentRecordId: 1 });
notificationSchema.index({ scheduledAt: 1 });
// Compound index for duplicate notification checks
notificationSchema.index({ type: 1, paymentRecordId: 1, createdAt: -1 });
notificationSchema.index({ type: 1, leaseId: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);

module.exports = Notification;
