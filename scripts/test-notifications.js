/**
 * Test Notification Script
 * 
 * This script tests the notification system by:
 * 1. Creating test notifications directly
 * 2. Testing cron job functions
 * 3. Verifying notifications are stored and retrievable
 * 
 * Usage: node scripts/test-notifications.js
 */

// Load environment variables
try {
  require("dotenv").config();
} catch (error) {
  console.warn("⚠️  dotenv not available, using environment variables directly");
}

const mongoose = require("mongoose");
const path = require("path");

// Load config
let config;
try {
  config = require(path.join(__dirname, "../config/config"));
} catch (error) {
  console.error("❌ Error loading config:", error.message);
  process.exit(1);
}

// Load all models to register them with Mongoose
require("../models/User");
require("../models/Property");
require("../models/Lease");
require("../models/Tenant");
require("../models/Landlord");
require("../models/LeasePaymentRecord");
require("../models/Notification");
require("../models/NotificationRecipient");
require("../models/NotificationPreference");

// Now import models for use
const User = require("../models/User");
const Property = require("../models/Property");
const Lease = require("../models/Lease");
const LeasePaymentRecord = require("../models/LeasePaymentRecord");
const Notification = require("../models/Notification");
const NotificationRecipient = require("../models/NotificationRecipient");
const {
  notifyPropertyCreated,
  notifyLeaseCreated,
  notifyLeaseActivated,
  notifyRentDue,
  notifyRentPaid,
  notifyRentOverdue,
  notifyLeaseExpiring,
} = require("../utils/notificationHelper");
const {
  checkAndNotifyRentNotReceived,
  checkAndNotifyLeaseExpiry,
} = require("../jobs/notificationCronJobs");

async function testNotifications() {
  console.log("🧪 Starting Notification System Test\n");
  console.log("=" .repeat(60));

  try {
    // Connect to MongoDB
    await mongoose.connect(config.mongodb.uri);
    console.log("✅ Connected to MongoDB\n");

    // Step 1: Find a test user (agent)
    console.log("📋 Step 1: Finding test user...");
    const testUser = await User.findOne({ role: { $in: ["AGENT", "AGENCY_ADMIN"] } }).lean();
    
    if (!testUser) {
      console.error("❌ No agent user found. Please create an agent user first.");
      process.exit(1);
    }
    
    console.log(`✅ Found test user: ${testUser.email} (ID: ${testUser._id})\n`);

    // Step 2: Find or create test data
    console.log("📋 Step 2: Finding test data...");
    let property = await Property.findOne({ agentId: testUser._id }).lean();
    let lease = await Lease.findOne({ agentId: testUser._id, status: "ACTIVE" })
      .populate("propertyId", "title address")
      .populate("tenantId", "firstName lastName")
      .lean();

    if (!property) {
      console.log("⚠️  No property found. Creating test notifications without property data...\n");
    } else {
      console.log(`✅ Found property: ${property.title}\n`);
    }

    if (!lease) {
      console.log("⚠️  No active lease found. Some tests will be skipped...\n");
    } else {
      console.log(`✅ Found lease: ${lease.leaseNumber || lease._id}\n`);
    }

    // Step 3: Test direct notification creation
    console.log("=" .repeat(60));
    console.log("📋 Step 3: Testing Direct Notification Creation\n");

    // Test 1: Property Created
    if (property) {
      console.log("📝 Test 1: Property Created Notification...");
      try {
        await notifyPropertyCreated(property._id.toString(), testUser._id.toString());
        console.log("✅ Property Created notification sent\n");
      } catch (error) {
        console.error(`❌ Failed: ${error.message}\n`);
      }
    }

    // Test 2: Lease Created
    if (lease) {
      console.log("📝 Test 2: Lease Created Notification...");
      try {
        await notifyLeaseCreated(lease._id.toString(), testUser._id.toString());
        console.log("✅ Lease Created notification sent\n");
      } catch (error) {
        console.error(`❌ Failed: ${error.message}\n`);
      }
    }

    // Test 3: Lease Activated
    if (lease) {
      console.log("📝 Test 3: Lease Activated Notification...");
      try {
        await notifyLeaseActivated(lease._id.toString(), testUser._id.toString());
        console.log("✅ Lease Activated notification sent\n");
      } catch (error) {
        console.error(`❌ Failed: ${error.message}\n`);
      }
    }

    // Test 4: Rent Due
    if (lease) {
      console.log("📝 Test 4: Rent Due Notification...");
      try {
        // Find or create a payment record
        let paymentRecord = await LeasePaymentRecord.findOne({
          leaseId: lease._id,
          type: "RENT",
        }).lean();

        if (!paymentRecord) {
          // Create a test payment record
          paymentRecord = await LeasePaymentRecord.create({
            leaseId: lease._id,
            agentId: testUser._id,
            type: "RENT",
            label: "Test Rent Payment",
            dueDate: new Date(),
            amountDue: 1000,
            status: "PENDING",
            amountPaid: null,
            charges: [],
          });
        }

        await notifyRentDue(
          paymentRecord._id.toString(),
          lease._id.toString(),
          testUser._id.toString()
        );
        console.log("✅ Rent Due notification sent\n");
      } catch (error) {
        console.error(`❌ Failed: ${error.message}\n`);
      }
    }

    // Test 5: Rent Paid
    if (lease) {
      console.log("📝 Test 5: Rent Paid Notification...");
      try {
        let paymentRecord = await LeasePaymentRecord.findOne({
          leaseId: lease._id,
          type: "RENT",
        }).lean();

        if (paymentRecord) {
          await notifyRentPaid(
            paymentRecord._id.toString(),
            lease._id.toString(),
            testUser._id.toString()
          );
          console.log("✅ Rent Paid notification sent\n");
        } else {
          console.log("⚠️  Skipped - No payment record found\n");
        }
      } catch (error) {
        console.error(`❌ Failed: ${error.message}\n`);
      }
    }

    // Test 6: Rent Overdue
    if (lease) {
      console.log("📝 Test 6: Rent Overdue Notification...");
      try {
        // Create or find an overdue payment
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);

        let overduePayment = await LeasePaymentRecord.findOne({
          leaseId: lease._id,
          dueDate: { $lt: new Date() },
          status: { $in: ["PENDING", "OVERDUE"] },
        }).lean();

        if (!overduePayment) {
          overduePayment = await LeasePaymentRecord.create({
            leaseId: lease._id,
            agentId: testUser._id,
            type: "RENT",
            label: "Overdue Test Payment",
            dueDate: yesterday,
            amountDue: 1000,
            status: "PENDING",
            amountPaid: null,
            charges: [],
          });
        }

        const daysOverdue = Math.floor(
          (new Date().getTime() - new Date(overduePayment.dueDate).getTime()) /
            (1000 * 60 * 60 * 24)
        );

        await notifyRentOverdue(
          overduePayment._id.toString(),
          lease._id.toString(),
          testUser._id.toString(),
          daysOverdue
        );
        console.log("✅ Rent Overdue notification sent\n");
      } catch (error) {
        console.error(`❌ Failed: ${error.message}\n`);
      }
    }

    // Test 7: Lease Expiring
    if (lease) {
      console.log("📝 Test 7: Lease Expiring Notification...");
      try {
        // Update lease end date to 60 days from now for testing
        const sixtyDaysFromNow = new Date();
        sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);
        
        await Lease.findByIdAndUpdate(lease._id, {
          endDate: sixtyDaysFromNow,
        });

        await notifyLeaseExpiring(lease._id.toString(), 60);
        console.log("✅ Lease Expiring notification sent\n");
      } catch (error) {
        console.error(`❌ Failed: ${error.message}\n`);
      }
    }

    // Step 4: Test cron job functions
    console.log("=" .repeat(60));
    console.log("📋 Step 4: Testing Cron Job Functions\n");

    // Test Rent Not Received Cron
    console.log("📝 Testing checkAndNotifyRentNotReceived...");
    try {
      const rentResult = await checkAndNotifyRentNotReceived();
      console.log(`✅ Rent Not Received Check:`);
      console.log(`   - Checked: ${rentResult.checked} payments`);
      console.log(`   - Notifications Created: ${rentResult.notificationsCreated}`);
      console.log(`   - Updated: ${rentResult.updatedCount}`);
      console.log(`   - Errors: ${rentResult.errors}\n`);
    } catch (error) {
      console.error(`❌ Failed: ${error.message}\n`);
    }

    // Test Lease Expiry Cron
    console.log("📝 Testing checkAndNotifyLeaseExpiry...");
    try {
      const leaseResult = await checkAndNotifyLeaseExpiry();
      console.log(`✅ Lease Expiry Check:`);
      console.log(`   - Checked: ${leaseResult.checked} leases`);
      console.log(`   - Notifications Created: ${leaseResult.notificationsCreated}`);
      console.log(`   - Errors: ${leaseResult.errors}\n`);
    } catch (error) {
      console.error(`❌ Failed: ${error.message}\n`);
    }

    // Step 5: Verify notifications in database
    console.log("=" .repeat(60));
    console.log("📋 Step 5: Verifying Notifications in Database\n");

    const recentNotifications = await Notification.find({
      createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) }, // Last 5 minutes
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    console.log(`✅ Found ${recentNotifications.length} notifications created in last 5 minutes:\n`);

    for (const notif of recentNotifications) {
      const recipients = await NotificationRecipient.find({
        notificationId: notif._id,
      }).lean();

      console.log(`📬 ${notif.type}`);
      console.log(`   Title: ${notif.title}`);
      console.log(`   Body: ${notif.body}`);
      console.log(`   Priority: ${notif.priority}`);
      console.log(`   Recipients: ${recipients.length}`);
      console.log(`   Created: ${notif.createdAt.toLocaleString()}`);
      console.log("");
    }

    // Step 6: Check unread count
    console.log("=" .repeat(60));
    console.log("📋 Step 6: Checking Notification Statistics\n");

    const allRecipients = await NotificationRecipient.find({
      userId: testUser._id.toString(),
    }).lean();

    const unreadCount = allRecipients.filter((r) => !r.readAt).length;
    const totalCount = allRecipients.length;

    console.log(`✅ Notification Statistics for ${testUser.email}:`);
    console.log(`   - Total Notifications: ${totalCount}`);
    console.log(`   - Unread: ${unreadCount}`);
    console.log(`   - Read: ${totalCount - unreadCount}\n`);

    console.log("=" .repeat(60));
    console.log("✅ Notification System Test Completed!\n");
    console.log("💡 Next Steps:");
    console.log("   1. Check notifications in the UI at: http://localhost:5100/notifications");
    console.log("   2. Check the bell icon in the header for unread count");
    console.log("   3. Verify notifications appear in real-time via SSE\n");

  } catch (error) {
    console.error("❌ Error during test:", error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB");
  }
}

// Run the test
testNotifications()
  .then(() => {
    console.log("\n✨ Test script finished successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Test script failed:", error);
    process.exit(1);
  });
