const cron = require("node-cron");
const config = require("../../config/config");

let initialized = false;

function initializeCronJobs() {
  if (initialized) {
    console.log('Cron jobs already initialized');
    return;
  }

  const cronEnabled = config.cron.enabled;

  if (!cronEnabled) {
    console.log('Cron jobs are disabled via CRON_ENABLED environment variable');
    return;
  }

  console.log('Initializing cron jobs...');

  try {
    const { startLeaseCronJobs } = require("../../jobs/leaseCronJobs");
    startLeaseCronJobs();
    
    // Other cron jobs will be added as we implement them
    // initializeRentGenerationCron();
    // initializeRentNotReceivedCron();
    // initializeVacantPropertyCron();
    
    initialized = true;
    console.log('All cron jobs initialized successfully');
  } catch (error) {
    console.error("Failed to initialize cron jobs:", error);
  }
}

module.exports = { initializeCronJobs };

