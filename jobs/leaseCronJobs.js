const cron = require("node-cron");
const LeaseService = require("../api/v1/services/leaseService");

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
};

module.exports = {
  startLeaseCronJobs,
  checkAndTerminateExpiredLeases,
  checkAndActivatePendingLeases,
};

