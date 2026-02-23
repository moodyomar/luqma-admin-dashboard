# 🔔 Driver Notifications - Manual Deployment Guide

## ⚠️ Issue

Firebase CLI is showing a CPU configuration error when trying to deploy:
```
Error: Cannot set CPU on the functions inviteUser,removeDriver,sendPromotionalNotification because they are GCF gen 1
```

## ✅ What's Already Done

1. **New Cloud Functions Created:**
   - `functions/src/notifyDriversOnOrderUpdate.ts`
   - Exports: `notifyDriversOnNewOrder` and `notifyDriversOnOrderUpdate`

2. **Functions Compiled:**
   - TypeScript compiled successfully to `functions/lib/`

3. **Old Functions Deleted:**
   - Deleted `onOrderCreated` (was skipping notifications)
   - Deleted `onOrderStatusChange` (was skipping notifications)

4. **Added to exports:**
   - Updated `functions/src/index.ts` to export new functions

## 🎯 What the New Functions Do

### `notifyDriversOnNewOrder`
**Triggers:** When a new order is created
**Condition:** Order status is "preparing" AND deliveryMethod is "delivery"
**Notification:**
```
Title: "طلب جديد! 🎉"
Body: "طلب توصيل جديد - [Customer Name]"
```

### `notifyDriversOnOrderUpdate`
**Triggers:** When order status changes
**Conditions:** 
- Status changes to "preparing" OR "ready"
- deliveryMethod is "delivery"

**Notifications:**
- **For "preparing":**
  ```
  Title: "طلب جديد قيد التحضير 📦"
  Body: "طلب جديد #[OrderID] - [Customer Name]"
  ```

- **For "ready":**
  ```
  Title: "طلب جاهز للتوصيل! ✅"
  Body: "الطلب #[OrderID] جاهز الآن - [Address]"
  Sound: VITE_NOTIFICATION_SOUND or default (e.g. notification.mp3)
  ```

## 🔧 Manual Deployment Options

### **Option 1: Firebase Console (Web UI)**

1. Go to: https://console.firebase.google.com/project/qbmenu-7963c/functions
2. Click "Create Function" (or use Cloud Console)
3. Upload the compiled code from `functions/lib/`

### **Option 2: Google Cloud Console**

1. Go to: https://console.cloud.google.com/functions/list?project=qbmenu-7963c
2. Click "Create Function"
3. Set trigger: Firestore → `menus/{businessId}/orders/{orderId}`
4. For onCreate: Select "Document created"
5. For onUpdate: Select "Document updated"
6. Upload source code

### **Option 3: Fix CLI Error**

The error suggests a configuration mismatch. Try:

```bash
# Option A: Update to latest firebase-functions
cd functions
npm install firebase-functions@latest
npm run build
cd ..
firebase deploy --only functions

# Option B: Check Google Cloud Console for CPU settings
# Go to Cloud Functions console and manually adjust settings
```

## 🧪 Testing Notifications

Once deployed, test by:

1. **Create a test order** in admin dashboard
2. **Accept the order** (status → "preparing")
3. **Driver should receive:** "طلب جديد قيد التحضير 📦"

4. **Mark order as ready** (status → "ready")  
5. **Driver should receive:** "طلب جاهز للتوصيل! ✅"

## 📋 Verification

Check if functions deployed:
```bash
firebase functions:list
```

Check logs:
```bash
firebase functions:log
```

## 🎯 Current Status

- ✅ Functions written and compiled
- ✅ Old non-working functions deleted
- ⏳ **Pending:** Deploy new functions (workaround needed for CLI error)

---

**The code is ready and working - we just need to get past the deployment CLI error!**

