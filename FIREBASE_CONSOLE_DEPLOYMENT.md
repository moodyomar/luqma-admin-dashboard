# 🚀 Firebase Console Manual Deployment Guide

## 📍 Firebase Console Link
**https://console.firebase.google.com/project/qbmenu-7963c/functions**

---

## 🎯 Deploy 4 Functions (Copy & Paste Ready)

You'll create 4 Cloud Functions. Each takes ~2-3 minutes to deploy.

---

## 1️⃣ **onOrderCreated** (Customer - Order Confirmed)

### Settings:
- **Name:** `onOrderCreated`
- **Trigger:** Cloud Firestore
- **Event Type:** `Document Created`
- **Document path:** `menus/{brandId}/orders/{orderId}`
- **Runtime:** Node.js 20
- **Entry point:** `onOrderCreated`

### Code (index.js):

```javascript
const {onDocumentCreated} = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

// Initialize if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

// Helper: Send notifications via Expo
async function sendPushNotifications(messages) {
  const fetch = require('node-fetch');
  
  const chunks = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }
  
  for (const chunk of chunks) {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chunk)
    });
    
    const data = await response.json();
    console.log('Expo push response:', data);
  }
}

// Helper: Send notification to customer
async function sendNotificationToUser(phone, content, orderId, status, deliveryMethod) {
  const usersSnapshot = await admin.firestore()
    .collection('users')
    .where('phone', '==', phone)
    .limit(1)
    .get();
  
  if (usersSnapshot.empty) {
    console.log('No user found with phone:', phone);
    return;
  }
  
  const userDoc = usersSnapshot.docs[0];
  const userData = userDoc.data();
  const userId = userDoc.id;
  
  // Get active customer app tokens
  const tokens = (userData.pushTokens || [])
    .filter(t => t.active && (!t.appType || t.appType === 'customer'))
    .map(t => t.token);
  
  if (tokens.length === 0) {
    console.log('No active push tokens for customer');
    return;
  }
  
  const language = userData.language || 'ar';
  const localizedContent = content[language] || content.ar;
  
  const messages = tokens.map(token => ({
    to: token,
    sound: 'default',
    title: localizedContent.title,
    body: localizedContent.body,
    data: {
      orderId,
      status,
      screen: 'MyOrdersScreen'
    },
  }));
  
  await sendPushNotifications(messages);
  
  await admin.firestore().collection('notificationLogs').add({
    userId,
    orderId,
    status,
    deliveryMethod,
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    tokensCount: tokens.length
  });
  
  console.log(`✅ Sent ${messages.length} notifications to customer for order ${orderId}`);
}

exports.onOrderCreated = onDocumentCreated('menus/{brandId}/orders/{orderId}', async (event) => {
  const order = event.data.data();
  const { phone, deliveryMethod, uid } = order;
  const orderId = uid || event.params.orderId;
  
  console.log(`New order created: ${orderId}`);
  
  const content = {
    ar: { 
      title: 'تم تأكيد طلبك 🎉', 
      body: deliveryMethod === 'pickup' 
        ? 'جاهز للاستلام خلال 30 دقيقة' 
        : 'يصلك خلال 45 دقيقة'
    },
    he: { 
      title: 'ההזמנה אושרה 🎉', 
      body: deliveryMethod === 'pickup'
        ? 'מוכן לאיסוף תוך 30 דקות'
        : 'מגיע תוך 45 דקות'
    }
  };
  
  await sendNotificationToUser(phone, content, orderId, 'pending', deliveryMethod);
  return null;
});
```

### package.json dependencies:
```json
{
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^5.0.0",
    "node-fetch": "^2.7.0"
  }
}
```

---

## 2️⃣ **onOrderStatusChange** (Customer - Status Updates)

### Settings:
- **Name:** `onOrderStatusChange`
- **Trigger:** Cloud Firestore
- **Event Type:** `Document Updated`
- **Document path:** `menus/{brandId}/orders/{orderId}`
- **Runtime:** Node.js 20
- **Entry point:** `onOrderStatusChange`

### Code (index.js):

```javascript
const {onDocumentUpdated} = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

async function sendPushNotifications(messages) {
  const fetch = require('node-fetch');
  
  const chunks = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }
  
  for (const chunk of chunks) {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chunk)
    });
    
    const data = await response.json();
    console.log('Expo push response:', data);
  }
}

async function sendNotificationToUser(phone, content, orderId, status, deliveryMethod) {
  const usersSnapshot = await admin.firestore()
    .collection('users')
    .where('phone', '==', phone)
    .limit(1)
    .get();
  
  if (usersSnapshot.empty) {
    console.log('No user found with phone:', phone);
    return;
  }
  
  const userDoc = usersSnapshot.docs[0];
  const userData = userDoc.data();
  const userId = userDoc.id;
  
  const tokens = (userData.pushTokens || [])
    .filter(t => t.active && (!t.appType || t.appType === 'customer'))
    .map(t => t.token);
  
  if (tokens.length === 0) {
    console.log('No active push tokens for customer');
    return;
  }
  
  const language = userData.language || 'ar';
  const localizedContent = content[language] || content.ar;
  
  const messages = tokens.map(token => ({
    to: token,
    sound: 'default',
    title: localizedContent.title,
    body: localizedContent.body,
    data: {
      orderId,
      status,
      screen: 'MyOrdersScreen'
    },
  }));
  
  await sendPushNotifications(messages);
  
  console.log(`✅ Sent ${messages.length} notifications to customer for order ${orderId}`);
}

exports.onOrderStatusChange = onDocumentUpdated('menus/{brandId}/orders/{orderId}', async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  
  if (before.status === after.status) {
    console.log('Status unchanged, skipping notification');
    return null;
  }
  
  console.log(`Order ${event.params.orderId} status changed: ${before.status} → ${after.status}`);
  
  const { status, phone, uid, deliveryMethod } = after;
  const orderId = uid || event.params.orderId;
  
  // Skip "preparing" status for customers (not actionable)
  if (status === 'preparing') {
    console.log('Skipping "preparing" notification for customer');
    return null;
  }
  
  // For PICKUP: Only send "ready"
  if (deliveryMethod === 'pickup' && status !== 'ready') {
    console.log(`Skipping "${status}" for pickup order`);
    return null;
  }
  
  // For DELIVERY: Only send "out_for_delivery" and "delivered"
  if (deliveryMethod === 'delivery' && !['out_for_delivery', 'delivered'].includes(status)) {
    console.log(`Skipping "${status}" for delivery order`);
    return null;
  }
  
  const notifications = {
    'ready': {
      ar: { title: 'طلبك جاهز! 📦', body: 'يمكنك استلام طلبك الآن' },
      he: { title: 'ההזמנה מוכנה! 📦', body: 'אפשר לקחת את ההזמנה עכשיו' }
    },
    'out_for_delivery': {
      ar: { title: 'طلبك في الطريق 🚗', body: 'السائق في الطريق إليك' },
      he: { title: 'ההזמנה בדרך 🚗', body: 'הנהג בדרך אליך' }
    },
    'delivered': {
      ar: { title: 'تم التوصيل بنجاح ✅', body: 'شكراً لك! نتمنى أن تستمتع بوجبتك' },
      he: { title: 'המשלוח הושלם ✅', body: 'תודה! נקווה שתיהנה מהארוחה' }
    }
  };
  
  const notif = notifications[status];
  if (!notif) {
    console.log('No notification template for status:', status);
    return null;
  }
  
  await sendNotificationToUser(phone, notif, orderId, status, deliveryMethod);
  return null;
});
```

---

## 3️⃣ **notifyDriversOnStatusChange** (Driver - Preparing & Ready)

### Settings:
- **Name:** `notifyDriversOnStatusChange`
- **Trigger:** Cloud Firestore
- **Event Type:** `Document Updated`
- **Document path:** `menus/{businessId}/orders/{orderId}`
- **Runtime:** Node.js 20
- **Entry point:** `notifyDriversOnStatusChange`

### Code (index.js):

```javascript
const {onDocumentUpdated} = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

async function sendPushNotifications(messages) {
  const fetch = require('node-fetch');
  
  const chunks = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }
  
  for (const chunk of chunks) {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chunk)
    });
    
    const data = await response.json();
    console.log('Expo push response:', data);
  }
}

exports.notifyDriversOnStatusChange = onDocumentUpdated('menus/{businessId}/orders/{orderId}', async (event) => {
  const businessId = event.params.businessId;
  const orderId = event.params.orderId;
  
  const before = event.data.before.data();
  const after = event.data.after.data();
  
  // Check if status changed
  if (before.status === after.status) {
    console.log('Status unchanged, skipping driver notification');
    return null;
  }
  
  const newStatus = after.status;
  const deliveryMethod = after.deliveryMethod;
  
  // Only notify DRIVERS for delivery orders
  if (deliveryMethod !== 'delivery') {
    console.log(`Order ${orderId} is not a delivery order, skipping driver notification`);
    return null;
  }
  
  // Only notify drivers when status changes to "preparing" or "ready"
  if (newStatus !== 'preparing' && newStatus !== 'ready') {
    console.log(`Status is ${newStatus}, not preparing/ready, skipping driver notification`);
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
        
        // Only get DRIVER app tokens
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
      console.warn(`No driver push tokens found for business ${businessId}`);
      return null;
    }
    
    console.log(`Found ${tokens.length} driver push tokens`);
    
    // Prepare notification based on status
    let title, body;
    
    if (newStatus === 'preparing') {
      title = 'طلب جديد قيد التحضير 📦';
      body = `طلب جديد #${orderId.slice(0, 6)} - ${after.customerName || after.name || 'عميل'}`;
    } else if (newStatus === 'ready') {
      title = 'طلب جاهز للتوصيل! ✅';
      body = `الطلب #${orderId.slice(0, 6)} جاهز الآن - ${after.address || ''}`;
    }
    
    const messages = tokens.map(token => ({
      to: token,
      sound: 'default',
      title: title,
      body: body,
      data: {
        type: 'order_status_change',
        orderId: orderId,
        businessId: businessId,
        status: newStatus,
      },
    }));
    
    await sendPushNotifications(messages);
    
    console.log(`✅ Sent ${tokens.length} notifications to drivers for order ${orderId}`);
    return null;
  } catch (error) {
    console.error('Error sending driver notification:', error);
    return null;
  }
});
```

---

## 4️⃣ **notifyDriversOnCreate** (Driver - New Order)

### Settings:
- **Name:** `notifyDriversOnCreate`
- **Trigger:** Cloud Firestore
- **Event Type:** `Document Created`
- **Document path:** `menus/{businessId}/orders/{orderId}`
- **Runtime:** Node.js 20
- **Entry point:** `notifyDriversOnCreate`

### Code (index.js):

```javascript
const {onDocumentCreated} = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

async function sendPushNotifications(messages) {
  const fetch = require('node-fetch');
  
  const chunks = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }
  
  for (const chunk of chunks) {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chunk)
    });
    
    const data = await response.json();
    console.log('Expo push response:', data);
  }
}

exports.notifyDriversOnCreate = onDocumentCreated('menus/{businessId}/orders/{orderId}', async (event) => {
  const businessId = event.params.businessId;
  const orderId = event.params.orderId;
  const orderData = event.data.data();
  
  // Only notify drivers for delivery orders
  if (orderData.deliveryMethod !== 'delivery') {
    console.log(`Order ${orderId} is not a delivery order, skipping driver notification`);
    return null;
  }
  
  // Only notify if order is in "preparing" status on creation
  if (orderData.status !== 'preparing') {
    console.log(`New order ${orderId} has status ${orderData.status}, not preparing`);
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
      console.warn(`No driver push tokens found for business ${businessId}`);
      return null;
    }
    
    console.log(`Found ${tokens.length} driver push tokens for new order`);
    
    const title = 'طلب جديد! 🎉';
    const body = `طلب توصيل جديد - ${orderData.customerName || orderData.name || 'عميل'}`;
    
    const messages = tokens.map(token => ({
      to: token,
      sound: 'default',
      title: title,
      body: body,
      data: {
        type: 'new_order',
        orderId: orderId,
        businessId: businessId,
        status: orderData.status,
      },
    }));
    
    await sendPushNotifications(messages);
    
    console.log(`✅ Sent ${tokens.length} notifications to drivers for new order ${orderId}`);
    return null;
  } catch (error) {
    console.error('Error sending driver notification:', error);
    return null;
  }
});
```

---

## 📋 Deployment Checklist

Deploy in this order:

1. ✅ `onOrderCreated` (Customer - CRITICAL)
2. ✅ `onOrderStatusChange` (Customer - CRITICAL)
3. ✅ `notifyDriversOnStatusChange` (Driver - NEW)
4. ✅ `notifyDriversOnCreate` (Driver - NEW)

---

## ✅ Verification

After deploying all 4 functions, run:

```bash
firebase functions:list
```

You should see:
- inviteUser
- removeDriver
- sendPromotionalNotification
- **onOrderCreated** ← RESTORED
- **onOrderStatusChange** ← RESTORED  
- **notifyDriversOnStatusChange** ← NEW
- **notifyDriversOnCreate** ← NEW

---

## 🧪 Testing

### Test Customer Notifications:
1. Place an order in customer app
2. Customer should receive: "تم تأكيد طلبك 🎉"

### Test Driver Notifications:
1. Admin accepts order (status → "preparing")
2. Driver should receive: "طلب جديد قيد التحضير 📦"
3. Admin marks ready (status → "ready")
4. Driver should receive: "طلب جاهز للتوصيل! ✅"

---

**All functions are now safely separated - customers and drivers get their respective notifications!** 🎉

