const cron = require("node-cron");
const LeaseService = require("../api/v1/services/leaseService");
const LeasePaymentRecord = require("../models/LeasePaymentRecord");
const Lease = require("../models/Lease");

const checkAndTerminateExpiredLeases = async () => {
  try {
    console.log("[CRON] Running checkAndTerminateExpiredLeases...");
    const result = await LeaseService.checkAndTerminateExpiredLeases();
    console.log(`[CRON] Terminated ${result.terminated} expired leases. Errors: ${result.errors}`);
    if (result.errors > 0) {
      console.error("[CRON] Errors:", result.details.errors);
    }
  } catch (error) {
    console.error("[CRON] Error in checkAndTerminateExpiredLeases:", error);
  }
};

const checkAndActivatePendingLeases = async () => {
  try {
    console.log("[CRON] Running checkAndActivatePendingLeases...");
    const result = await LeaseService.checkAndActivatePendingLeases();
    console.log(`[CRON] Activated ${result.activated} pending leases. Errors: ${result.errors}`);
    if (result.errors > 0) {
      console.error("[CRON] Errors:", result.details.errors);
    }
  } catch (error) {
    console.error("[CRON] Error in checkAndActivatePendingLeases:", error);
  }
};

const generateUpcomingRentPayments = async () => {
  try {
    console.log("[CRON] Running generateUpcomingRentPayments...");

    const now = new Date();
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(now.getDate() + 3);

    const activeLeases = await LeaseService.getActiveLeasesForPayments(
      now,
      threeDaysFromNow
    );

    let createdCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const lease of activeLeases) {
      try {
        // Edge case: Verify lease is still ACTIVE (might have been terminated/cancelled since query)
        const currentLease = await Lease.findById(lease._id).lean();
        
        if (!currentLease || currentLease.status !== 'ACTIVE') {
          skippedCount++;
          continue;
        }

        // Edge case: Verify lease hasn't expired
        if (currentLease.endDate && new Date(currentLease.endDate) < now) {
          skippedCount++;
          continue;
        }

        const dueDate = lease.nextDueDate;

        // Edge case: Check for existing payment with same due date (prevent duplicates)
        const existing = await LeasePaymentRecord.findOne({
          leaseId: lease._id,
          type: "RENT",
          dueDate,
          status: { $ne: 'CANCELLED' },
        });

        if (existing) {
          skippedCount++;
          continue;
        }

        // Edge case: Verify due date is within lease period
        if (currentLease.startDate && new Date(dueDate) < new Date(currentLease.startDate)) {
          skippedCount++;
          continue;
        }
        
        if (currentLease.endDate && new Date(dueDate) > new Date(currentLease.endDate)) {
          skippedCount++;
          continue;
        }

        await LeasePaymentRecord.create({
          leaseId: lease._id,
          agentId: lease.agentId,
          type: "RENT",
          label: `Rent for ${dueDate.toLocaleDateString("en-US", {
            month: "short",
            year: "numeric",
          })}`,
          dueDate,
          amountDue: lease.rentAmount,
          status: "PENDING",
          amountPaid: null,
          paidDate: null,
          paymentMethod: null,
          paymentReference: null,
          invoiceUrl: null,
          receiptUrl: null,
          notes: null,
          isFirstMonthRent: false,
          isSecurityDeposit: false,
          charges: [],
        });

        createdCount += 1;
      } catch (error) {
        errorCount++;
        console.error(`[CRON] Error processing lease ${lease._id}:`, error.message);
      }
    }

    console.log(
      `[CRON] generateUpcomingRentPayments: Created ${createdCount}, Skipped ${skippedCount}, Errors ${errorCount}`
    );
  } catch (error) {
    console.error("[CRON] Error in generateUpcomingRentPayments:", error);
  }
};

const startLeaseCronJobs = () => {
  console.log("[CRON] Starting lease cron jobs...");

  cron.schedule("0 0 * * *", checkAndTerminateExpiredLeases, {
    scheduled: true,
    timezone: "UTC",
  });
  console.log("[CRON] Scheduled checkAndTerminateExpiredLeases to run daily at midnight UTC");

  cron.schedule("0 0 * * *", checkAndActivatePendingLeases, {
    scheduled: true,
    timezone: "UTC",
  });
  console.log("[CRON] Scheduled checkAndActivatePendingLeases to run daily at midnight UTC");

  cron.schedule("0 0 * * *", generateUpcomingRentPayments, {
    scheduled: true,
    timezone: "UTC",
  });
  console.log("[CRON] Scheduled generateUpcomingRentPayments to run daily at midnight UTC");
};

module.exports = {
  startLeaseCronJobs,
  checkAndTerminateExpiredLeases,
  checkAndActivatePendingLeases,
  generateUpcomingRentPayments,
};

