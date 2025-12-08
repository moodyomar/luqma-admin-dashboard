# 📢 Notification System Documentation

## ✅ Working Configuration

This document explains how the promotional notification system works and how to debug issues.

---

## 🏗️ Architecture Overview

### User Storage
- **All users** (customers and drivers) are stored in the **same collection**: `users`
- **Distinguished by:**
  - `appType: "driver"` in push tokens (for driver app users)
  - `appType: "customer"` or `undefined` (for customer app users)
  - `phone` field (required for customer users)

### Token Structure
Push tokens are stored in `users/{userId}/pushTokens` array:
```javascript
{
  pushTokens: [
    {
      token: "ExponentPushToken[...]",
      active: true,
      appType: "customer" | "driver" | undefined,
      platform: "ios" | "android",
      device: "iPhone" | "Android",
      lastUpdated: "2025-11-23T..."
    }
  ]
}
```

---

## 🔍 How Filtering Works

### Admin Dashboard UI (`BusinessManagePage.jsx`)

When loading users for the notification interface:

1. **Filters out drivers:**
   - Checks if user has ANY token with `appType === 'driver'`
   - If yes → excludes entire user from list

2. **Filters out users without phone numbers:**
   - Only shows users with `phone` field set
   - Drivers typically don't have phone numbers

3. **Result:** Only customer users with phone numbers appear in the UI

### Cloud Function (`sendPromotionalNotification.ts`)

When sending to "all users":

1. **Fetches all users** from `users` collection
2. **Filters to customer users only:**
   - Must have `phone` field
   - Must NOT have any tokens with `appType === 'driver'`
3. **Extracts customer tokens:**
   - Only includes tokens where `appType !== 'driver'`
   - Only includes `active: true` tokens
   - Only includes tokens starting with `ExponentPushToken`
4. **Sends notifications** to customer tokens only

---

## 🐛 Common Issues & Solutions

### Issue: "Sent to 0 users"

**Possible Causes:**
1. **All users are drivers** → Check `usersWithDriverTokens` count in debug info
2. **No active tokens** → Check `usersWithNoTokens` count
3. **Tokens are inactive** → Users need to enable push notifications in app
4. **Token format issue** → Tokens must start with `ExponentPushToken`

**Debug Steps:**
1. Check browser console for `[NOTIFICATION] Debug Information:`
2. Look at:
   - `Users with customer tokens` - should be > 0
   - `Customer tokens found` - should be > 0
   - `Users with driver tokens` - these are excluded
   - `Users with no tokens` - these users need to enable notifications

### Issue: "PUSH_TOO_MANY_EXPERIENCE_IDS" Error

**Cause:** Mixing tokens from different Expo projects in the same batch
- `@devmoody/luqma` (customer app)
- `@devmoody/luqma-driver-app` (driver app)

**Solution:** The filtering logic should prevent this by:
- Excluding users with ANY driver tokens
- Only including customer app tokens

**If still happening:**
- Check if filtering is working (see debug logs)
- Verify `appType` is set correctly on tokens
- Check Cloud Function logs for `[TOKEN_FILTER]` messages

---

## 📊 Debug Information

### Browser Console

When sending a notification, check the console for:

```
🔍 [NOTIFICATION] Debug Information:
  📊 Total users processed: 12
  ✅ Users with customer tokens: 11
  🚫 Users with driver tokens (excluded): 0
  ❌ Users with no tokens: 1
  📱 Customer tokens found: 14
  🚗 Driver tokens found (excluded): 0
  📦 Chunks sent: 1
```

### Cloud Function Logs

View logs via CLI:
```bash
cd admin-dashboard
firebase functions:log --only sendPromotionalNotification | tail -100
```

Or in Firebase Console:
https://console.firebase.google.com/project/qbmenu-7963c/functions/logs

Look for:
- `[TOKEN_FILTER]` - Token filtering summary
- `[USER ...]` - Individual user processing
- `[NOTIFICATION_RESULT]` - Final send results

---

## 🔧 Key Code Locations

### Admin Dashboard
- **User Loading:** `admin-dashboard/pages/BusinessManagePage.jsx` → `loadUsers()`
- **Sending:** `admin-dashboard/pages/BusinessManagePage.jsx` → `handleSendNotification()`

### Cloud Function
- **Main Function:** `admin-dashboard/functions/src/sendPromotionalNotification.ts`
- **Token Filtering:** Lines 132-201
- **Notification Sending:** Lines 237-320

---

## ✅ What's Working

1. ✅ **Filtering drivers** - Users with driver tokens are excluded
2. ✅ **Filtering users without phones** - Only real customers shown
3. ✅ **Token extraction** - Only customer app tokens are used
4. ✅ **Debug logging** - Detailed info in console and logs
5. ✅ **Error handling** - Proper error messages and warnings

---

## 🚨 Important Notes

1. **Drivers and customers in same collection** - This is intentional and works correctly with proper filtering
2. **Token `appType` field** - Critical for distinguishing customer vs driver tokens
3. **Phone number required** - Users without phone numbers are excluded (they're not real customers)
4. **Multiple tokens per user** - Users can have multiple devices, each with its own token
5. **Active tokens only** - Only `active: true` tokens are used

---

## 📝 Testing Checklist

When testing notifications:

- [ ] Check browser console for debug info
- [ ] Verify `Users with customer tokens` > 0
- [ ] Verify `Customer tokens found` > 0
- [ ] Check Cloud Function logs for `[TOKEN_FILTER]` messages
- [ ] Verify no `PUSH_TOO_MANY_EXPERIENCE_IDS` errors
- [ ] Confirm notifications received on customer devices
- [ ] Verify drivers do NOT receive promotional notifications

---

## 🔄 If Something Breaks

1. **Check browser console** - Look for debug information
2. **Check Cloud Function logs** - Look for `[TOKEN_FILTER]` and `[USER` messages
3. **Verify token structure** - Check if `appType` is set correctly
4. **Verify filtering logic** - Make sure drivers are being excluded
5. **Check Expo API errors** - Look for `PUSH_TOO_MANY_EXPERIENCE_IDS` or other errors

---

## 📞 Support

If notifications stop working:
1. Check this document first
2. Review debug logs (browser console + Cloud Function logs)
3. Verify token structure in Firestore
4. Check if filtering logic is still working

**Last Updated:** 2025-11-23
**Status:** ✅ Working - Sending to 14 customer tokens from 11 users




