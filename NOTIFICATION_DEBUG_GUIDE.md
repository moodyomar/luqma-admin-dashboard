# 🐛 Notification System Debug Guide

## Quick Debug Steps

### 1. Check Browser Console

After sending a notification, open browser console (F12) and look for:

```
🔍 [NOTIFICATION] Debug Information:
  📊 Total users processed: X
  ✅ Users with customer tokens: X
  🚫 Users with driver tokens (excluded): X
  ❌ Users with no tokens: X
  📱 Customer tokens found: X
  🚗 Driver tokens found (excluded): X
```

### 2. Check Cloud Function Logs

```bash
cd admin-dashboard
firebase functions:log --only sendPromotionalNotification | tail -100
```

Look for:
- `[TOKEN_FILTER]` messages
- `[USER ...]` messages showing individual user processing
- `[NOTIFICATION_RESULT]` showing final counts

### 3. Common Issues

#### Issue: `sentTo: 0`

**Check debug info:**
- If `Users with customer tokens: 0` → All users are drivers or have no tokens
- If `Customer tokens found: 0` → Tokens are inactive or wrong format
- If `Users with no tokens: X` → Users need to enable push notifications

#### Issue: `PUSH_TOO_MANY_EXPERIENCE_IDS`

**Cause:** Driver and customer tokens mixed in same batch

**Fix:** 
- Verify filtering is working (check `[TOKEN_FILTER]` logs)
- Check if `appType` is set correctly on tokens
- Ensure users with driver tokens are excluded

---

## Token Structure Reference

### Customer Token (Correct)
```javascript
{
  token: "ExponentPushToken[ABC123...]",
  active: true,
  appType: "customer" // or undefined
}
```

### Driver Token (Excluded)
```javascript
{
  token: "ExponentPushToken[XYZ789...]",
  active: true,
  appType: "driver" // ← This excludes the user
}
```

---

## Filtering Logic Flow

```
1. Get all users from `users` collection
   ↓
2. Filter: Must have `phone` field
   ↓
3. Check: Does user have ANY token with `appType === 'driver'`?
   ├─ YES → Exclude entire user (skip all their tokens)
   └─ NO → Continue
   ↓
4. Extract customer tokens:
   - Only `active: true`
   - Only `appType !== 'driver'`
   - Only starts with `ExponentPushToken`
   ↓
5. Send notifications to customer tokens only
```

---

## Expected Log Output (Working)

```
[TOKEN_FILTER] ========== TOKEN FILTERING SUMMARY ==========
[TOKEN_FILTER] Processed 12 users
[TOKEN_FILTER] Users with customer tokens: 11
[TOKEN_FILTER] Users with driver tokens (excluded): 0
[TOKEN_FILTER] Users with no tokens: 1
[TOKEN_FILTER] Found 14 customer app tokens
[TOKEN_FILTER] Found 0 driver app tokens (excluded)
[TOKEN_FILTER] Using 14 customer app tokens for notification
[TOKEN_FILTER] ✅ Proceeding to send 14 notifications
[NOTIFICATION_RESULT] Successfully sent: 14
```

---

## Firestore Structure

### User Document
```
users/{userId}
  ├─ phone: "+972..."
  ├─ name: "..."
  └─ pushTokens: [
       {
         token: "ExponentPushToken[...]",
         active: true,
         appType: "customer" | "driver" | undefined,
         platform: "ios",
         device: "iPhone",
         lastUpdated: "..."
       }
     ]
```

---

## Quick Fixes

### If 0 users receiving:
1. Check if users have `phone` field
2. Check if tokens have `active: true`
3. Check if `appType` is NOT `"driver"`
4. Check if tokens start with `ExponentPushToken`

### If mixing driver/customer tokens:
1. Verify filtering logic excludes users with driver tokens
2. Check `appType` field on tokens
3. Ensure user-level filtering (not just token-level)

---

**Last Verified:** 2025-11-23
**Status:** ✅ Working correctly

