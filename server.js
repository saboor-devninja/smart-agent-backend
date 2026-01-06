const mongoose = require("mongoose");
const app = require("./app");
const config = require("./config/config");

const PORT = config.port || 5000;

// MongoDB Connection
mongoose
  .connect(config.mongodb.uri)
  .then(() => {
    console.log('✅ MongoDB connected successfully');
    
    // Initialize cron jobs (after DB connection)
    if (config.cron.enabled) {
      const { initializeCronJobs } = require("./services/cron/initialize");
      initializeCronJobs();
    }
    
    // Start server after DB connection
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📝 Environment: ${config.env}`);
      if (config.cron.enabled) {
        console.log(`⏰ Cron jobs: ENABLED`);
      }
    });
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  });

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});

