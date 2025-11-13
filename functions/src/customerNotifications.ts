import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

/**
 * CUSTOMER NOTIFICATIONS - Restored from Menu-reactnative
 * These send notifications to customers about their orders
 */

// ==========================================
// HELPER: SEND NOTIFICATION TO USER (CUSTOMER)
// ==========================================
async function sendNotificationToUser(
  phone: string,
  content: any,
  orderId: string,
  status: string,
  deliveryMethod: string
) {
  // Get user document by phone number
  const usersSnapshot = await admin
    .firestore()
    .collection("users")
    .where("phone", "==", phone)
    .limit(1)
    .get();

  if (usersSnapshot.empty) {
    console.log("No user found with phone:", phone);
    return;
  }

  const userDoc = usersSnapshot.docs[0];
  const userData = userDoc.data();
  const userId = userDoc.id;

  // Get active push tokens (customer app tokens)
  const tokens = (userData.pushTokens || [])
    .filter((t: any) => t.active && (!t.appType || t.appType === "customer"))
    .map((t: any) => t.token);

  if (tokens.length === 0) {
    console.log("No active push tokens for user");
    return;
  }

  // Get user's preferred language (default to Arabic)
  const language = userData.language || "ar";
  const localizedContent = content[language] || content.ar;

  // Prepare push notification messages
  const messages = tokens.map((token: string) => ({
    to: token,
    sound: "default",
    title: localizedContent.title,
    body: localizedContent.body,
    data: {
      orderId,
      status,
      screen: "MyOrdersScreen",
    },
    channelId: "default",
  }));

  // Send push notifications via Expo Push API
  await sendPushNotifications(messages);

  // Log notification sent
  await admin
    .firestore()
    .collection("notificationLogs")
    .add({
      userId,
      orderId,
      status,
      deliveryMethod,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      tokensCount: tokens.length,
    });

  console.log(`✅ Sent ${messages.length} notifications for order ${orderId}`);
}

// ==========================================
// HELPER: SEND PUSH NOTIFICATIONS VIA EXPO
// ==========================================
async function sendPushNotifications(messages: any[]) {
  const fetch = require("node-fetch");

  // Expo limits to 100 notifications per request
  const chunks = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }

  for (const chunk of chunks) {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(chunk),
    });

    const data = await response.json();
    console.log("Expo push response:", JSON.stringify(data, null, 2));
  }
}

// ==========================================
// 1. NEW ORDER CREATED → SEND "ORDER CONFIRMED" TO CUSTOMER
// ==========================================
export const onOrderCreated = onDocumentCreated("menus/{brandId}/orders/{orderId}", async (event) => {
  if (!event.data) return null;
  
  const snap = event.data;
  const order = snap.data();
    const { phone, deliveryMethod, uid: orderId } = order;

    console.log(`New order created: ${orderId}`);

    // Send "Order Confirmed" notification to CUSTOMER
    const content = {
      ar: {
        title: "تم تأكيد طلبك 🎉",
        body:
          deliveryMethod === "pickup"
            ? "جاهز للاستلام خلال 30 دقيقة"
            : "يصلك خلال 45 دقيقة",
      },
      he: {
        title: "ההזמנה אושרה 🎉",
        body:
          deliveryMethod === "pickup"
            ? "מוכן לאיסוף תוך 30 דקות"
            : "מגיע תוך 45 דקות",
      },
    };

    await sendNotificationToUser(
      phone,
      content,
      orderId || event.params.orderId,
      "pending",
      deliveryMethod
    );
    
    return null;
  });

// ==========================================
// 2. ORDER STATUS CHANGES → SEND STATUS UPDATE TO CUSTOMER
// Smart notifications: Only send what matters!
// ==========================================
export const onOrderStatusChange = onDocumentUpdated("menus/{brandId}/orders/{orderId}", async (event) => {
  if (!event.data) return null;
  
  const change = event.data;
  const before = change.before.data();
  const after = change.after.data();

    // Only trigger if status actually changed
    if (before.status === after.status) {
      console.log("Status unchanged, skipping notification");
      return;
    }

    console.log(
      `Order ${event.params.orderId} status changed: ${before.status} → ${after.status}`
    );

    const { status, phone, uid: orderId, deliveryMethod } = after;

    // ==========================================
    // SMART NOTIFICATION LOGIC FOR CUSTOMERS
    // Only send important notifications based on delivery method
    // ==========================================

    // Skip "preparing" status (too much noise, not actionable for customer)
    if (status === "preparing") {
      console.log('Skipping "preparing" notification (not important)');
      return null;
    }

    // For PICKUP: Only send "pending" and "ready"
    if (
      deliveryMethod === "pickup" &&
      !["pending", "ready"].includes(status)
    ) {
      console.log(`Skipping "${status}" for pickup order (not relevant)`);
      return null;
    }

    // For DELIVERY: Only send "pending", "out_for_delivery", and optionally "delivered"
    if (
      deliveryMethod === "delivery" &&
      !["pending", "out_for_delivery", "delivered"].includes(status)
    ) {
      console.log(`Skipping "${status}" for delivery order (not relevant)`);
      return null;
    }

    // Notification content (Arabic & Hebrew) for CUSTOMERS
    const notifications: any = {
      // For ALL orders: Confirmation
      pending: {
        ar: {
          title: "تم تأكيد طلبك 🎉",
          body:
            deliveryMethod === "pickup"
              ? "جاهز للاستلام خلال 30 دقيقة"
              : "يصلك خلال 45 دقيقة",
        },
        he: {
          title: "ההזמנה אושרה 🎉",
          body:
            deliveryMethod === "pickup"
              ? "מוכן לאיסוף תוך 30 דקות"
              : "מגיע תוך 45 דקות",
        },
      },
      // For PICKUP orders: Ready notification
      ready: {
        ar: { title: "طلبك جاهز! 📦", body: "يمكنك استلام طلبك الآن" },
        he: { title: "ההזמנה מוכנה! 📦", body: "אפשר לקחת את ההזמנה עכשיו" },
      },
      // For DELIVERY orders: Driver on the way
      out_for_delivery: {
        ar: { title: "طلبك في الطريق 🚗", body: "السائق في الطريق إليك" },
        he: { title: "ההזמנה בדרך 🚗", body: "הנהג בדרך אליך" },
      },
      // For DELIVERY orders: Delivered (optional)
      delivered: {
        ar: {
          title: "تم التوصيل بنجاح ✅",
          body: "شكراً لك! نتمنى أن تستمتع بوجبتك",
        },
        he: {
          title: "המשלוח הושלם ✅",
          body: "תודה! נקווה שתיהנה מהארוחה",
        },
      },
    };

    const notif = notifications[status];
    if (!notif) {
      console.log("No notification template for status:", status);
      return null;
    }

    // Send notification to CUSTOMER using helper function
    await sendNotificationToUser(
      phone,
      notif,
      orderId || event.params.orderId,
      status,
      deliveryMethod
    );
    
    return null;
  });

