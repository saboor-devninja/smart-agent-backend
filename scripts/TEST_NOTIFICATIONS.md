# Testing Notifications

## Quick Test Methods

### Method 1: Run Test Script (Recommended)

Run the comprehensive test script that tests all notification types:

```bash
cd backend
node scripts/test-notifications.js
```

**What it tests:**
- ✅ Property Created notifications
- ✅ Lease Created notifications
- ✅ Lease Activated notifications
- ✅ Rent Due notifications
- ✅ Rent Paid notifications
- ✅ Rent Overdue notifications
- ✅ Lease Expiring notifications
- ✅ Cron job functions (Rent Not Received, Lease Expiry)
- ✅ Database verification
- ✅ Notification statistics

**Prerequisites:**
- MongoDB connection configured
- At least one agent user in the database
- (Optional) At least one property and active lease for full testing

### Method 2: Test via API

#### 1. Get Your Notifications

```bash
# Make sure you're logged in and have a token
curl -X GET http://localhost:5000/api/v1/notifications \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 2. Get Unread Count

```bash
curl -X GET http://localhost:5000/api/v1/notifications/unread-count \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### 3. Mark as Read

```bash
curl -X PATCH http://localhost:5000/api/v1/notifications/read \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notificationIds": ["NOTIFICATION_ID"]}'
```

### Method 3: Test Cron Jobs Manually

You can manually trigger the cron job functions:

```javascript
// In Node.js REPL or script
const { checkAndNotifyRentNotReceived, checkAndNotifyLeaseExpiry } = require('./jobs/notificationCronJobs');

// Test rent not received
await checkAndNotifyRentNotReceived();

// Test lease expiry
await checkAndNotifyLeaseExpiry();
```

### Method 4: Test Real-Time (SSE)

1. Open browser console
2. Connect to SSE endpoint:
```javascript
const token = localStorage.getItem('token');
const eventSource = new EventSource(`http://localhost:5000/api/v1/notifications/sse?token=${token}`);

eventSource.onmessage = (event) => {
  console.log('Notification update:', JSON.parse(event.data));
};
```

### Method 5: Create Test Data and Trigger Notifications

#### Create a Test Overdue Payment

```javascript
// In MongoDB shell or script
const LeasePaymentRecord = require('./models/LeasePaymentRecord');
const Lease = require('./models/Lease');

// Find an active lease
const lease = await Lease.findOne({ status: 'ACTIVE' });

// Create overdue payment
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);

await LeasePaymentRecord.create({
  leaseId: lease._id,
  agentId: lease.agentId,
  type: 'RENT',
  label: 'Test Overdue Payment',
  dueDate: yesterday,
  amountDue: 1000,
  status: 'PENDING',
  amountPaid: null,
  charges: [],
});

// Then run the cron job
const { checkAndNotifyRentNotReceived } = require('./jobs/notificationCronJobs');
await checkAndNotifyRentNotReceived();
```

#### Create a Test Expiring Lease

```javascript
// Update lease end date to 60 days from now
const lease = await Lease.findOne({ status: 'ACTIVE' });
const sixtyDaysFromNow = new Date();
sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);

await Lease.findByIdAndUpdate(lease._id, {
  endDate: sixtyDaysFromNow,
});

// Then run the cron job
const { checkAndNotifyLeaseExpiry } = require('./jobs/notificationCronJobs');
await checkAndNotifyLeaseExpiry();
```

## Verification Checklist

After running tests, verify:

- [ ] Notifications appear in database (`Notification` collection)
- [ ] Recipients are created (`NotificationRecipient` collection)
- [ ] Unread count is correct
- [ ] Notifications appear in UI dropdown
- [ ] Notifications appear in `/notifications` page
- [ ] SSE updates work in real-time
- [ ] Mark as read functionality works
- [ ] Archive functionality works

## Troubleshooting

### No notifications appearing?

1. **Check MongoDB connection**
   ```bash
   # Verify connection
   node -e "require('mongoose').connect('YOUR_MONGODB_URI').then(() => console.log('Connected'))"
   ```

2. **Check user exists**
   ```javascript
   const User = require('./models/User');
   const user = await User.findOne({ role: 'AGENT' });
   console.log('User:', user);
   ```

3. **Check notification preferences**
   ```javascript
   const NotificationPreference = require('./models/NotificationPreference');
   const prefs = await NotificationPreference.findOne({ userId: 'USER_ID' });
   console.log('Preferences:', prefs);
   ```

4. **Check logs**
   - Look for errors in server console
   - Check cron job logs
   - Verify notification creation logs

### Notifications created but not showing in UI?

1. **Check SSE connection**
   - Open browser DevTools → Network tab
   - Look for SSE connection to `/notifications/sse`
   - Check for connection errors

2. **Check authentication**
   - Verify token is valid
   - Check if user is logged in
   - Verify token in localStorage

3. **Check frontend service**
   - Open browser DevTools → Console
   - Look for API errors
   - Check network requests to `/api/v1/notifications`
