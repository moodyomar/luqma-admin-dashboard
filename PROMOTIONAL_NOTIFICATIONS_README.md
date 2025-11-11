# Promotional Notifications Feature

## Overview
This feature allows admins to send push notifications to all users or specific users directly from the Business Management page.

## What Was Added

### Frontend (Admin Dashboard)
1. **New UI Section** in `pages/BusinessManagePage.jsx`:
   - Collapsible "שליחת הודעות ללקוחות 📢" section
   - Title input (max 65 characters) with character counter
   - Body textarea (max 240 characters) with character counter
   - Target audience selector (All Users / Specific Users)
   - User selection list (when specific users selected)
   - Real-time notification preview
   - Send button with loading state

2. **Updated Files**:
   - `pages/BusinessManagePage.jsx` - Main UI and logic
   - `src/index.css` - Added spinner animation

### Backend (Firebase Cloud Functions)
1. **New Function**: `functions/src/sendPromotionalNotification.ts`
   - Validates admin role before sending
   - Supports sending to all users or specific user IDs
   - Fetches FCM tokens from Firestore
   - Sends multicast notifications via Firebase Cloud Messaging
   - Returns success count and failure count

2. **Updated Files**:
   - `functions/src/index.ts` - Exports the new function
   - `functions/package.json` - Updated Node runtime to v20

## How It Works

1. Admin opens Business Management page
2. Clicks "שליחת הודעות ללקוחות 📢" to expand the section
3. Fills in notification title and body
4. Selects target audience:
   - **All Users**: Sends to everyone in the business
   - **Specific Users**: Shows checkbox list to select users
5. Reviews the preview
6. Clicks "שלח הודעה" button
7. Cloud Function:
   - Verifies admin role
   - Validates input (title ≤ 65, body ≤ 240)
   - Fetches target user IDs
   - Retrieves FCM tokens from Firestore
   - Sends push notification via FCM
   - Returns success count
8. Admin sees success message with count

## Prerequisites

### Firestore Structure
Users must have FCM tokens stored in their documents:
```javascript
users/{userId}: {
  fcmToken: "user-fcm-token-here",  // or pushToken, or deviceToken
  businessId: "business-id",
  // ... other user data
}
```

### React Native App
The mobile app must:
1. Register for push notifications
2. Store FCM token in Firestore `users/{userId}` collection
3. Handle incoming notifications

## Testing

### 1. Test UI (Frontend)
```bash
npm run dev
```
- Navigate to Business Management page
- Click "שליחת הודעות ללקוחות 📢"
- Verify UI displays correctly
- Test character counters
- Test target audience switcher
- Check preview updates

### 2. Deploy Cloud Function
```bash
# Make sure you're using Node 20+
nvm use 20

# Deploy all functions
cd functions
npm run build
cd ..
firebase deploy --only functions

# Or deploy just the notification function
firebase deploy --only functions:sendPromotionalNotification
```

### 3. Test End-to-End
1. Ensure you have users with FCM tokens in Firestore
2. Login as admin
3. Go to Business Management → Notifications
4. Fill in title: "Test Notification"
5. Fill in body: "This is a test message"
6. Select "All Users"
7. Click Send
8. Check mobile devices for notification

## Troubleshooting

### Cloud Function Deployment Issues

**Issue: Node version error**
```
Runtime Node.js 18 was decommissioned
```
**Solution**: Update `functions/package.json` to use Node 20:
```json
"engines": {
  "node": "20"
}
```

**Issue: CPU configuration error for Gen 1 functions**
```
Cannot set CPU on the functions because they are GCF gen 1
```
**Solution**: Either remove CPU configuration or migrate to Gen 2 functions.

### No Notifications Received

**Check:**
1. Users have valid FCM tokens in Firestore
2. Mobile app has notification permissions enabled
3. FCM token field name matches (fcmToken, pushToken, or deviceToken)
4. Cloud Function logs: `firebase functions:log`

### Permission Denied

**Error**: "Only admins can send promotional notifications"

**Solution**: Ensure your user has the admin role in custom claims:
```javascript
{
  roles: ['admin'],
  businessIds: ['your-business-id']
}
```

## Security

- ✅ Only admins can send notifications (verified in Cloud Function)
- ✅ Input validation (character limits, required fields)
- ✅ Business ID scoping (users only from same business)
- ✅ Auth context checked before execution

## Character Limits

- **Title**: 65 characters (FCM notification title limit)
- **Body**: 240 characters (recommended for visibility across devices)

## Future Enhancements

- [ ] Schedule notifications for future delivery
- [ ] Notification templates
- [ ] Analytics (delivery rate, open rate)
- [ ] Rich notifications with images
- [ ] User segments (e.g., "Active users", "Inactive users")
- [ ] A/B testing for notification content
- [ ] Notification history/logs in admin dashboard

