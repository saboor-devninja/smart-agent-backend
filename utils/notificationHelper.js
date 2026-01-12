const NotificationService = require("../api/v1/services/notificationService");
const User = require("../models/User");

/**
 * Helper function to create notifications for relevant users
 * @param {Object} notificationData - Notification data
 * @param {Array} recipientUserIds - Array of user IDs to notify
 * @returns {Promise<void>}
 */
async function createNotification(notificationData, recipientUserIds = []) {
  if (!recipientUserIds || recipientUserIds.length === 0) {
    return;
  }

  try {
    const recipients = recipientUserIds.map((userId) => ({
      userId: userId.toString(),
      channels: undefined, // Will use user preferences
    }));

    await NotificationService.createNotification(notificationData, recipients);
  } catch (error) {
    console.error("Error creating notification:", error);
    // Don't throw - notifications are non-critical
  }
}

/**
 * Get user IDs to notify for a property
 * @param {String} propertyId - Property ID
 * @param {String} agentId - Agent ID (will always be notified)
 * @returns {Promise<Array>} Array of user IDs
 */
async function getPropertyNotificationRecipients(propertyId, agentId) {
  const Property = require("../models/Property");
  const property = await Property.findById(propertyId).lean();
  
  if (!property) {
    return [agentId];
  }

  const recipients = [agentId];
  
  // Add landlord if exists
  if (property.landlordId) {
    const Landlord = require("../models/Landlord");
    const landlord = await Landlord.findById(property.landlordId).lean();
    if (landlord && landlord.agentId && landlord.agentId.toString() !== agentId.toString()) {
      recipients.push(landlord.agentId.toString());
    }
  }

  return recipients;
}

/**
 * Get user IDs to notify for a lease
 * @param {String} leaseId - Lease ID
 * @returns {Promise<Array>} Array of user IDs
 */
async function getLeaseNotificationRecipients(leaseId) {
  const Lease = require("../models/Lease");
  const lease = await Lease.findById(leaseId)
    .populate("propertyId", "agentId landlordId")
    .lean();
  
  if (!lease) {
    return [];
  }

  const recipients = [];
  
  // Add agent
  if (lease.agentId) {
    recipients.push(lease.agentId.toString());
  }
  
  // Add property agent if different
  if (lease.propertyId?.agentId && lease.propertyId.agentId.toString() !== lease.agentId?.toString()) {
    recipients.push(lease.propertyId.agentId.toString());
  }

  return [...new Set(recipients)]; // Remove duplicates
}

/**
 * Notify property created
 */
async function notifyPropertyCreated(propertyId, agentId) {
  const Property = require("../models/Property");
  const property = await Property.findById(propertyId).lean();
  
  if (!property) return;

  const recipients = await getPropertyNotificationRecipients(propertyId, agentId);
  
  await createNotification(
    {
      type: "PROPERTY_CREATED",
      title: "New Property Created",
      body: `Property "${property.title}" has been created`,
      priority: "NORMAL",
      metadata: {
        propertyId: property._id.toString(),
        propertyTitle: property.title,
        propertyAddress: property.address,
        action: "created",
      },
      propertyId: property._id.toString(),
      actorId: agentId,
    },
    recipients
  );
}

/**
 * Notify lease created
 */
async function notifyLeaseCreated(leaseId, agentId) {
  const Lease = require("../models/Lease");
  const lease = await Lease.findById(leaseId)
    .populate("propertyId", "title address")
    .populate("tenantId", "firstName lastName")
    .lean();
  
  if (!lease) return;

  const recipients = await getLeaseNotificationRecipients(leaseId);
  
  await createNotification(
    {
      type: "LEASE_CREATED",
      title: "New Lease Created",
      body: `Lease created for property "${lease.propertyId?.title || "Unknown"}"`,
      priority: "NORMAL",
      metadata: {
        leaseId: lease._id.toString(),
        propertyId: lease.propertyId?._id?.toString(),
        propertyTitle: lease.propertyId?.title,
        tenantName: lease.tenantId ? `${lease.tenantId.firstName} ${lease.tenantId.lastName}` : "Unknown",
        action: "created",
      },
      leaseId: lease._id.toString(),
      propertyId: lease.propertyId?._id?.toString(),
      tenantId: lease.tenantId?._id?.toString(),
      actorId: agentId,
    },
    recipients
  );
}

/**
 * Notify lease activated
 */
async function notifyLeaseActivated(leaseId, agentId) {
  const Lease = require("../models/Lease");
  const lease = await Lease.findById(leaseId)
    .populate("propertyId", "title address")
    .populate("tenantId", "firstName lastName")
    .lean();
  
  if (!lease) return;

  const recipients = await getLeaseNotificationRecipients(leaseId);
  
  await createNotification(
    {
      type: "LEASE_STARTED",
      title: "Lease Activated",
      body: `Lease for "${lease.propertyId?.title || "Unknown"}" has been activated`,
      priority: "HIGH",
      metadata: {
        leaseId: lease._id.toString(),
        propertyId: lease.propertyId?._id?.toString(),
        propertyTitle: lease.propertyId?.title,
        tenantName: lease.tenantId ? `${lease.tenantId.firstName} ${lease.tenantId.lastName}` : "Unknown",
        action: "started",
      },
      leaseId: lease._id.toString(),
      propertyId: lease.propertyId?._id?.toString(),
      tenantId: lease.tenantId?._id?.toString(),
      actorId: agentId,
    },
    recipients
  );
}

/**
 * Notify rent payment due
 */
async function notifyRentDue(paymentRecordId, leaseId, agentId) {
  const LeasePaymentRecord = require("../models/LeasePaymentRecord");
  const Lease = require("../models/Lease");
  
  const paymentRecord = await LeasePaymentRecord.findById(paymentRecordId).lean();
  const lease = await Lease.findById(leaseId)
    .populate("propertyId", "title address")
    .populate("tenantId", "firstName lastName")
    .lean();
  
  if (!paymentRecord || !lease) return;

  const recipients = await getLeaseNotificationRecipients(leaseId);
  
  await createNotification(
    {
      type: "RENT_DUE",
      title: "Rent Payment Due",
      body: `Rent payment of $${paymentRecord.amountDue || 0} is due for "${lease.propertyId?.title || "Unknown"}"`,
      priority: "HIGH",
      metadata: {
        paymentRecordId: paymentRecord._id.toString(),
        leaseId: lease._id.toString(),
        propertyId: lease.propertyId?._id?.toString(),
        propertyTitle: lease.propertyId?.title,
        tenantName: lease.tenantId ? `${lease.tenantId.firstName} ${lease.tenantId.lastName}` : "Unknown",
        amount: paymentRecord.amountDue || 0,
        dueDate: paymentRecord.dueDate,
      },
      paymentRecordId: paymentRecord._id.toString(),
      leaseId: lease._id.toString(),
      propertyId: lease.propertyId?._id?.toString(),
      actorId: agentId,
    },
    recipients
  );
}

/**
 * Notify rent payment received
 */
async function notifyRentPaid(paymentRecordId, leaseId, agentId) {
  const LeasePaymentRecord = require("../models/LeasePaymentRecord");
  const Lease = require("../models/Lease");
  
  const paymentRecord = await LeasePaymentRecord.findById(paymentRecordId).lean();
  const lease = await Lease.findById(leaseId)
    .populate("propertyId", "title address")
    .populate("tenantId", "firstName lastName")
    .lean();
  
  if (!paymentRecord || !lease) return;

  const recipients = await getLeaseNotificationRecipients(leaseId);
  
  await createNotification(
    {
      type: "RENT_PAID",
      title: "Rent Payment Received",
      body: `Rent payment of $${paymentRecord.amountPaid || 0} received for "${lease.propertyId?.title || "Unknown"}"`,
      priority: "NORMAL",
      metadata: {
        paymentRecordId: paymentRecord._id.toString(),
        leaseId: lease._id.toString(),
        propertyId: lease.propertyId?._id?.toString(),
        propertyTitle: lease.propertyId?.title,
        tenantName: lease.tenantId ? `${lease.tenantId.firstName} ${lease.tenantId.lastName}` : "Unknown",
        amount: paymentRecord.amountPaid || 0,
        paidDate: paymentRecord.paidDate,
      },
      paymentRecordId: paymentRecord._id.toString(),
      leaseId: lease._id.toString(),
      propertyId: lease.propertyId?._id?.toString(),
      actorId: agentId,
    },
    recipients
  );
}

/**
 * Notify rent payment overdue
 */
async function notifyRentOverdue(paymentRecordId, leaseId, agentId, daysOverdue) {
  const LeasePaymentRecord = require("../models/LeasePaymentRecord");
  const Lease = require("../models/Lease");
  
  const paymentRecord = await LeasePaymentRecord.findById(paymentRecordId).lean();
  const lease = await Lease.findById(leaseId)
    .populate("propertyId", "title address")
    .populate("tenantId", "firstName lastName")
    .lean();
  
  if (!paymentRecord || !lease) return;

  const recipients = await getLeaseNotificationRecipients(leaseId);
  
  // Calculate total amount due (base + charges)
  const amountDue = Number(paymentRecord.amountDue) || 0;
  const chargesTotal = Array.isArray(paymentRecord.charges) 
    ? paymentRecord.charges.reduce((sum, c) => sum + (Number(c.amount) || 0), 0) 
    : 0;
  const totalAmountDue = amountDue + chargesTotal;
  
  await createNotification(
    {
      type: "RENT_OVERDUE",
      title: "Rent Payment Overdue",
      body: `Rent payment of $${totalAmountDue.toFixed(2)} is ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue for "${lease.propertyId?.title || "Unknown"}"`,
      priority: "URGENT",
      metadata: {
        paymentRecordId: paymentRecord._id.toString(),
        leaseId: lease._id.toString(),
        propertyId: lease.propertyId?._id?.toString(),
        propertyTitle: lease.propertyId?.title,
        tenantName: lease.tenantId ? `${lease.tenantId.firstName} ${lease.tenantId.lastName}` : "Unknown",
        amount: totalAmountDue,
        dueDate: paymentRecord.dueDate,
        daysOverdue,
      },
      paymentRecordId: paymentRecord._id.toString(),
      leaseId: lease._id.toString(),
      propertyId: lease.propertyId?._id?.toString(),
      actorId: agentId,
    },
    recipients
  );
}

/**
 * Notify lease expiring soon
 */
async function notifyLeaseExpiring(leaseId, daysRemaining) {
  const Lease = require("../models/Lease");
  
  const lease = await Lease.findById(leaseId)
    .populate("propertyId", "title address agentId")
    .populate("tenantId", "firstName lastName")
    .lean();
  
  if (!lease || !lease.propertyId) return;

  const recipients = await getLeaseNotificationRecipients(leaseId);
  
  if (recipients.length === 0) {
    // Fallback to property agent if no lease agent
    if (lease.propertyId.agentId) {
      recipients.push(lease.propertyId.agentId.toString());
    }
  }
  
  if (recipients.length === 0) return;

  await createNotification(
    {
      type: "LEASE_ENDING_SOON",
      title: "Lease Expiring Soon",
      body: `Lease for "${lease.propertyId?.title || "Unknown"}" expires in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`,
      priority: "HIGH",
      metadata: {
        leaseId: lease._id.toString(),
        propertyId: lease.propertyId?._id?.toString(),
        propertyTitle: lease.propertyId?.title,
        tenantName: lease.tenantId ? `${lease.tenantId.firstName} ${lease.tenantId.lastName}` : "Unknown",
        daysRemaining,
        endDate: lease.endDate,
        leaseNumber: lease.leaseNumber || null,
      },
      leaseId: lease._id.toString(),
      propertyId: lease.propertyId?._id?.toString(),
      tenantId: lease.tenantId?._id?.toString(),
    },
    recipients
  );
}

module.exports = {
  createNotification,
  getPropertyNotificationRecipients,
  getLeaseNotificationRecipients,
  notifyPropertyCreated,
  notifyLeaseCreated,
  notifyLeaseActivated,
  notifyRentDue,
  notifyRentPaid,
  notifyRentOverdue,
  notifyLeaseExpiring,
};
