const cron = require("node-cron");
const LeasePaymentRecord = require("../models/LeasePaymentRecord");
const Lease = require("../models/Lease");
const Notification = require("../models/Notification");
const { notifyRentOverdue, notifyLeaseExpiring } = require("../utils/notificationHelper");

/**
 * Check for rent payments that are overdue and haven't been received
 * Sends notifications to agents when due date has passed and payment is still pending
 */
const checkAndNotifyRentNotReceived = async () => {
  try {
    console.log("[CRON] Running checkAndNotifyRentNotReceived...");

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Find all rent payments where:
    // 1. Due date has passed (dueDate < today)
    // 2. Status is still PENDING or OVERDUE (not paid)
    // 3. Payment hasn't been received (amountPaid is null or 0)
    const overdueUnpaidPayments = await LeasePaymentRecord.find({
      dueDate: { $lt: now },
      status: { $in: ["PENDING", "OVERDUE"] },
      $or: [{ amountPaid: null }, { amountPaid: 0 }],
    })
      .populate("leaseId", "agentId propertyId tenantId")
      .lean();

    console.log(`[CRON] Found ${overdueUnpaidPayments.length} overdue unpaid rent payments`);

    let notificationsCreated = 0;
    let errors = 0;
    let updatedCount = 0;

    for (const payment of overdueUnpaidPayments) {
      try {
        // Skip if no lease
        if (!payment.leaseId) {
          continue;
        }

        // Check if notification already exists for this payment in the last 12 hours
        const twelveHoursAgo = new Date();
        twelveHoursAgo.setHours(twelveHoursAgo.getHours() - 12);

        const existingNotification = await Notification.findOne({
          type: "RENT_OVERDUE",
          paymentRecordId: payment._id.toString(),
          createdAt: { $gte: twelveHoursAgo },
        }).lean();

        // Skip if notification already sent in the last 12 hours
        if (existingNotification) {
          continue;
        }

        // Calculate days overdue
        const daysOverdue = Math.floor(
          (now.getTime() - new Date(payment.dueDate).getTime()) / (1000 * 60 * 60 * 24)
        );

        // Update payment status to OVERDUE if still PENDING
        if (payment.status === "PENDING") {
          await LeasePaymentRecord.findByIdAndUpdate(payment._id, {
            status: "OVERDUE",
          });
          updatedCount++;
        }

        // Get agent ID from lease
        const agentId = payment.leaseId.agentId;
        if (!agentId) {
          console.log(`[CRON] Skipping payment ${payment._id} - no agent ID`);
          continue;
        }

        // Create notification
        await notifyRentOverdue(
          payment._id.toString(),
          payment.leaseId._id.toString(),
          agentId.toString(),
          daysOverdue
        );

        notificationsCreated++;
        console.log(
          `[CRON] Created notification for overdue rent payment: ${payment._id} (${daysOverdue} days overdue)`
        );
      } catch (error) {
        errors++;
        console.error(`[CRON] Error processing payment ${payment._id}:`, error.message);
      }
    }

    console.log(
      `[CRON] Rent not received check completed. Notifications: ${notificationsCreated}, Updated: ${updatedCount}, Errors: ${errors}`
    );

    return {
      checked: overdueUnpaidPayments.length,
      notificationsCreated,
      updatedCount,
      errors,
    };
  } catch (error) {
    console.error("[CRON] Error in checkAndNotifyRentNotReceived:", error);
    throw error;
  }
};

/**
 * Check for leases expiring in 2 months (60 days) and send notifications
 */
const checkAndNotifyLeaseExpiry = async () => {
  try {
    console.log("[CRON] Running checkAndNotifyLeaseExpiry...");

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Calculate date 2 months (60 days) from now
    const twoMonthsFromNow = new Date(now);
    twoMonthsFromNow.setDate(twoMonthsFromNow.getDate() + 60);
    twoMonthsFromNow.setHours(23, 59, 59, 999);

    // Find all active leases expiring in approximately 60 days
    // We check within a range to account for the cron running every 12 hours
    const expiringLeases = await Lease.find({
      status: "ACTIVE",
      endDate: {
        $gte: new Date(twoMonthsFromNow.getTime() - 12 * 60 * 60 * 1000), // 12 hours before
        $lte: twoMonthsFromNow,
      },
    })
      .populate("propertyId", "title address agentId")
      .populate("tenantId", "firstName lastName")
      .lean();

    console.log(`[CRON] Found ${expiringLeases.length} leases expiring in 2 months`);

    let notificationsCreated = 0;
    let errors = 0;

    for (const lease of expiringLeases) {
      try {
        // Skip if lease doesn't have an end date
        if (!lease.endDate) {
          continue;
        }

        // Calculate days remaining
        const daysRemaining = Math.ceil(
          (new Date(lease.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Check if notification already exists for this lease in the last 12 hours
        const twelveHoursAgo = new Date();
        twelveHoursAgo.setHours(twelveHoursAgo.getHours() - 12);

        const existingNotification = await Notification.findOne({
          type: "LEASE_ENDING_SOON",
          leaseId: lease._id.toString(),
          createdAt: { $gte: twelveHoursAgo },
        }).lean();

        // Skip if notification already sent in the last 12 hours
        if (existingNotification) {
          continue;
        }

        // Create notification
        await notifyLeaseExpiring(lease._id.toString(), daysRemaining);

        notificationsCreated++;
        console.log(
          `[CRON] Created notification for expiring lease: ${lease.leaseNumber || lease._id} (${daysRemaining} days remaining)`
        );
      } catch (error) {
        errors++;
        console.error(`[CRON] Error processing lease ${lease._id}:`, error.message);
      }
    }

    console.log(
      `[CRON] Lease expiry check completed. Notifications: ${notificationsCreated}, Errors: ${errors}`
    );

    return {
      checked: expiringLeases.length,
      notificationsCreated,
      errors,
    };
  } catch (error) {
    console.error("[CRON] Error in checkAndNotifyLeaseExpiry:", error);
    throw error;
  }
};

/**
 * Initialize notification cron jobs
 */
const startNotificationCronJobs = () => {
  console.log("[CRON] Starting notification cron jobs...");

  // Rent Not Received - Every 12 hours (00:00 and 12:00)
  cron.schedule(
    "0 0,12 * * *",
    async () => {
      try {
        await checkAndNotifyRentNotReceived();
      } catch (error) {
        console.error("[CRON] Error in rent not received cron:", error);
      }
    },
    {
      scheduled: true,
      timezone: "UTC",
    }
  );
  console.log(
    "[CRON] Scheduled checkAndNotifyRentNotReceived to run every 12 hours (00:00 and 12:00 UTC)"
  );

  // Lease Expiry - Every 12 hours (00:00 and 12:00)
  cron.schedule(
    "0 0,12 * * *",
    async () => {
      try {
        await checkAndNotifyLeaseExpiry();
      } catch (error) {
        console.error("[CRON] Error in lease expiry cron:", error);
      }
    },
    {
      scheduled: true,
      timezone: "UTC",
    }
  );
  console.log(
    "[CRON] Scheduled checkAndNotifyLeaseExpiry to run every 12 hours (00:00 and 12:00 UTC)"
  );
};

module.exports = {
  startNotificationCronJobs,
  checkAndNotifyRentNotReceived,
  checkAndNotifyLeaseExpiry,
};
