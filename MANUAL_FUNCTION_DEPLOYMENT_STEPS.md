# 🚀 Manual Cloud Function Deployment via Google Cloud Console

## 📋 Quick Steps

Since Firebase CLI has a CPU configuration error, deploy manually:

### **Step 1: Go to Google Cloud Console**

https://console.cloud.google.com/functions/list?project=qbmenu-7963c

### **Step 2: Create First Function - notifyDriversOnOrderUpdate**

1. Click "**CREATE FUNCTION**"
2. **Environment:** 2nd gen
3. **Function name:** `notifyDriversOnOrderUpdate`
4. **Region:** `us-central1`
5. **Trigger:**
   - **Trigger type:** Cloud Firestore
   - **Event type:** `onDocumentUpdated`
   - **Document path:** `menus/{businessId}/orders/{orderId}`
6. **Runtime:** Node.js 20
7. **Memory:** 256 MB
8. **Source code:** Inline editor
9. **Entry point:** `notifyDriversOnOrderUpdate`

**Copy this code:**

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

exports.notifyDriversOnOrderUpdate = functions.firestore
  .document('menus/{businessId}/orders/{orderId}')
  .onUpdate(async (change, context) => {
    const businessId = context.params.businessId;
    const orderId = context.params.orderId;
    
    const beforeData = change.before.data();
    const afterData = change.after.data();
    
    // Check if status changed
    if (beforeData.status === afterData.status) {
      console.log('Status unchanged, skipping notification');
      return null;
    }
    
    const newStatus = afterData.status;
    const deliveryMethod = afterData.deliveryMethod;
    
    // Only notify for delivery orders
    if (deliveryMethod !== 'delivery') {
      console.log(`Order ${orderId} is not a delivery order, skipping notification`);
      return null;
    }
    
    // Only notify when status changes to "preparing" or "ready"
    if (newStatus !== 'preparing' && newStatus !== 'ready') {
      console.log(`Status is ${newStatus}, not preparing/ready, skipping notification`);
      return null;
    }
    
    try {
      const db = admin.firestore();
      
      // Get all drivers for this business
      const driversSnapshot = await db
        .collection('menus')
        .doc(businessId)
        .collection('users')
        .where('role', '==', 'driver')
        .get();
      
      if (driversSnapshot.empty) {
        console.warn(`No drivers found for business ${businessId}`);
        return null;
      }
      
      const driverIds = driversSnapshot.docs.map(doc => doc.id);
      console.log(`Found ${driverIds.length} drivers for business ${businessId}`);
      
      // Fetch push tokens for all drivers
      const tokens = [];
      const batchSize = 10;
      
      for (let i = 0; i < driverIds.length; i += batchSize) {
        const batch = driverIds.slice(i, i + batchSize);
        const userDocs = await db
          .collection('users')
          .where(admin.firestore.FieldPath.documentId(), 'in', batch)
          .get();
        
        userDocs.forEach((doc) => {
          const userData = doc.data();
          
          // Check for pushTokens array (new structure)
          if (userData.pushTokens && Array.isArray(userData.pushTokens)) {
            userData.pushTokens.forEach((tokenObj) => {
              // Only add active driver tokens
              if (tokenObj.active && tokenObj.token && tokenObj.appType === 'driver') {
                tokens.push(tokenObj.token);
              }
            });
          }
        });
      }
      
      if (tokens.length === 0) {
        console.warn(`No push tokens found for drivers in business ${businessId}`);
        return null;
      }
      
      console.log(`Found ${tokens.length} driver push tokens`);
      
      // Send via Expo Push API
      const expoPushEndpoint = 'https://exp.host/--/api/v2/push/send';
      const messages = tokens.map(token => ({
        to: token,
        sound: newStatus === 'ready' ? 'default' : 'default',
        title: newStatus === 'preparing' ? 'طلب جديد قيد التحضير 📦' : 'طلب جاهز للتوصيل! ✅',
        body: newStatus === 'preparing' 
          ? `طلب جديد #${orderId.slice(0, 6)} - ${afterData.customerName || afterData.name || 'عميل'}`
          : `الطلب #${orderId.slice(0, 6)} جاهز الآن - ${afterData.address || ''}`,
        data: {
          type: 'order_status_change',
          orderId: orderId,
          businessId: businessId,
          status: newStatus,
        },
      }));
      
      const response = await fetch(expoPushEndpoint, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });
      
      const result = await response.json();
      console.log(`Notification sent for order ${orderId}:`, result);
      
      return { success: true, sentTo: tokens.length };
    } catch (error) {
      console.error('Error sending driver notification:', error);
      return null;
    }
  });
```

**Click DEPLOY**

---

### **Step 3: Create Second Function - notifyDriversOnNewOrder**

1. Click "**CREATE FUNCTION**" again
2. **Environment:** 2nd gen
3. **Function name:** `notifyDriversOnNewOrder`
4. **Region:** `us-central1`
5. **Trigger:**
   - **Trigger type:** Cloud Firestore
   - **Event type:** `onDocumentCreated`
   - **Document path:** `menus/{businessId}/orders/{orderId}`
6. **Runtime:** Node.js 20
7. **Memory:** 256 MB
8. **Entry point:** `notifyDriversOnNewOrder`

**Copy this code:**

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

exports.notifyDriversOnNewOrder = functions.firestore
  .document('menus/{businessId}/orders/{orderId}')
  .onCreate(async (snap, context) => {
    const businessId = context.params.businessId;
    const orderId = context.params.orderId;
    const orderData = snap.data();
    
    // Only notify for delivery orders
    if (orderData.deliveryMethod !== 'delivery') {
      console.log(`Order ${orderId} is not a delivery order, skipping notification`);
      return null;
    }
    
    // Only notify if order is already in "preparing" status on creation
    if (orderData.status !== 'preparing') {
      console.log(`New order ${orderId} has status ${orderData.status}, not preparing, skipping notification`);
      return null;
    }
    
    try {
      const db = admin.firestore();
      
      // Get all drivers for this business
      const driversSnapshot = await db
        .collection('menus')
        .doc(businessId)
        .collection('users')
        .where('role', '==', 'driver')
        .get();
      
      if (driversSnapshot.empty) {
        console.warn(`No drivers found for business ${businessId}`);
        return null;
      }
      
      const driverIds = driversSnapshot.docs.map(doc => doc.id);
      
      // Fetch push tokens
      const tokens = [];
      const batchSize = 10;
      
      for (let i = 0; i < driverIds.length; i += batchSize) {
        const batch = driverIds.slice(i, i + batchSize);
        const userDocs = await db
          .collection('users')
          .where(admin.firestore.FieldPath.documentId(), 'in', batch)
          .get();
        
        userDocs.forEach((doc) => {
          const userData = doc.data();
          
          if (userData.pushTokens && Array.isArray(userData.pushTokens)) {
            userData.pushTokens.forEach((tokenObj) => {
              if (tokenObj.active && tokenObj.token && tokenObj.appType === 'driver') {
                tokens.push(tokenObj.token);
              }
            });
          }
        });
      }
      
      if (tokens.length === 0) {
        console.warn(`No push tokens found for drivers in business ${businessId}`);
        return null;
      }
      
      console.log(`Found ${tokens.length} driver push tokens for new order`);
      
      // Send via Expo Push API
      const expoPushEndpoint = 'https://exp.host/--/api/v2/push/send';
      const messages = tokens.map(token => ({
        to: token,
        sound: 'default',
        title: 'طلب جديد! 🎉',
        body: `طلب توصيل جديد - ${orderData.customerName || orderData.name || 'عميل'}`,
        data: {
          type: 'new_order',
          orderId: orderId,
          businessId: businessId,
          status: orderData.status,
        },
      }));
      
      const response = await fetch(expoPushEndpoint, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });
      
      const result = await response.json();
      console.log(`New order notification sent:`, result);
      
      return { success: true, sentTo: tokens.length };
    } catch (error) {
      console.error('Error sending new order notification:', error);
      return null;
    }
  });
```

**Click DEPLOY**

---

## ✅ Verify Deployment

After both functions deploy (takes ~2-3 minutes each):

```bash
firebase functions:list
```

Should show:
- notifyDriversOnOrderUpdate
- notifyDriversOnNewOrder

---

## 🧪 Test

1. Create a new order in admin dashboard
2. Accept it (status → "preparing")
3. Driver app should receive: "طلب جديد قيد التحضير 📦"

---

**This bypasses the CLI error by using the web console directly!**

