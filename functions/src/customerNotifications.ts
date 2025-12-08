import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

/**
 * CUSTOMER NOTIFICATIONS - Restored from Menu-reactnative
 * These send notifications to customers about their orders
 */

// ==========================================
// HELPER: CHECK IF ORDER IS A FUTURE ORDER (not yet due)
// Returns true if order has a deliveryDateTime that is still in the future
// Returns false if order has no deliveryDateTime or if it's already due
// ==========================================
function isFutureOrderNotYetDue(orderData: any): boolean {
  const deliveryDateTime = orderData.deliveryDateTime;
  
  // If no deliveryDateTime, it's not a future order (regular order)
  if (!deliveryDateTime) {
    return false;
  }
  
  try {
    let deliveryDate: Date;
    
    // Handle Firestore Timestamp
    if (deliveryDateTime.toDate && typeof deliveryDateTime.toDate === 'function') {
      deliveryDate = deliveryDateTime.toDate();
    }
    // Handle Date object
    else if (deliveryDateTime instanceof Date) {
      deliveryDate = deliveryDateTime;
    }
    // Handle ISO string or timestamp number
    else {
      deliveryDate = new Date(deliveryDateTime);
    }
    
    // Check if date is valid
    if (isNaN(deliveryDate.getTime())) {
      console.log("Invalid deliveryDateTime, treating as regular order");
      return false;
    }
    
    // Check if delivery date is still in the future
    const now = new Date();
    const isStillFuture = deliveryDate > now;
    
    if (isStillFuture) {
      console.log(`Order has future deliveryDateTime: ${deliveryDate.toISOString()}, not yet due`);
    } else {
      console.log(`Order deliveryDateTime has passed: ${deliveryDate.toISOString()}, order is now due`);
    }
    
    return isStillFuture;
  } catch (error) {
    console.error("Error checking if order is future order:", error);
    // On error, treat as regular order (don't skip notification)
    return false;
  }
}

// ==========================================
// HELPER: CHECK IF ORDER WAS ORIGINALLY A FUTURE ORDER (now due)
// Returns true if order has deliveryDateTime that has passed (was scheduled)
// Returns false if order has no deliveryDateTime or if it's still in the future
// ==========================================
function isFutureOrderNowDue(orderData: any): boolean {
  const deliveryDateTime = orderData.deliveryDateTime;
  
  // If no deliveryDateTime, it's not a future order
  if (!deliveryDateTime) {
    return false;
  }
  
  try {
    let deliveryDate: Date;
    
    // Handle Firestore Timestamp
    if (deliveryDateTime.toDate && typeof deliveryDateTime.toDate === 'function') {
      deliveryDate = deliveryDateTime.toDate();
    }
    // Handle Date object
    else if (deliveryDateTime instanceof Date) {
      deliveryDate = deliveryDateTime;
    }
    // Handle ISO string or timestamp number
    else {
      deliveryDate = new Date(deliveryDateTime);
    }
    
    // Check if date is valid
    if (isNaN(deliveryDate.getTime())) {
      return false;
    }
    
    // Check if delivery date has passed (was scheduled, now due)
    const now = new Date();
    return deliveryDate <= now;
  } catch (error) {
    console.error("Error checking if order was future order:", error);
    return false;
  }
}

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

    // FUTURE ORDER LOGIC:
    // - If order has deliveryDateTime in the future → Skip notification now
    // - If order has no deliveryDateTime OR deliveryDateTime has passed → Send notification (normal behavior)
    // - Regular orders (no deliveryDateTime) work exactly as before
    if (isFutureOrderNotYetDue(order)) {
      console.log(`Order ${orderId} is a future order (scheduled for later), skipping immediate notification. Will notify when scheduled time arrives.`);
      return null;
    }

    // Check if this was a future order that is now due
    const wasFutureOrder = isFutureOrderNowDue(order);

    // REGULAR ORDER: Send "Order Confirmed" notification immediately (normal behavior)
    let content: any;

    if (wasFutureOrder) {
      // Future order that is now due - use special messages
      content = {
        ar: {
          title: "تم تأكيد طلبك المجدول 🎉",
          body: "رح نبدأ بتحضير طلبك حسب الموعد المحدد",
        },
        he: {
          title: "ההזמנה המתוזמנת אושרה 🎉",
          body: "נתחיל בהכנת ההזמנה שלך במועד שנקבע",
        },
      };
    } else if (deliveryMethod === "eat_in") {
      // Eat-in orders - no delivery/pickup time estimates
      content = {
        ar: {
          title: "تم تأكيد طلبك 🎉",
          body: "سنبدأ بتحضير طلبك قريباً",
        },
        he: {
          title: "ההזמנה אושרה 🎉",
          body: "נתחיל בהכנת ההזמנה שלך בקרוב",
        },
      };
    } else if (deliveryMethod === "pickup") {
      // Pickup orders - ready for pickup time
      content = {
        ar: {
          title: "تم تأكيد طلبك 🎉",
          body: "جاهز للاستلام خلال 30 دقيقة",
        },
        he: {
          title: "ההזמנה אושרה 🎉",
          body: "מוכן לאיסוף תוך 30 דקות",
        },
      };
    } else {
      // Delivery orders - delivery time estimate
      content = {
        ar: {
          title: "تم تأكيد طلبك 🎉",
          body: "يصلك خلال 45 دقيقة",
        },
        he: {
          title: "ההזמנה אושרה 🎉",
          body: "מגיע תוך 45 דקות",
        },
      };
    }

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

    // Check if table was assigned (for future order reservations)
    const tableWasAssigned = !before.tableNumber && after.tableNumber && after.reservationConfirmed;
    const isFutureReservation = tableWasAssigned && isFutureOrderNotYetDue(after);
    
    // Only trigger if status actually changed OR table was assigned
    if (before.status === after.status && !tableWasAssigned) {
      console.log("Status unchanged and no table assigned, skipping notification");
      return;
    }

    // If table was assigned for a future reservation, send notification
    if (isFutureReservation) {
      const { phone, uid: orderId, tableNumber, deliveryMethod } = after;
      console.log(`Table ${tableNumber} assigned for future reservation ${orderId}`);
      
      const content = {
        ar: {
          title: "تم تأكيد حجزك 🎉",
          body: `تم تعيين طاولة رقم ${tableNumber} لك. سنبدأ التحضير حسب الموعد المحدد.`,
        },
        he: {
          title: "ההזמנה אושרה 🎉",
          body: `שולחן מספר ${tableNumber} הוקצה עבורך. נתחיל בהכנה במועד שנקבע.`,
        },
      };
      
      await sendNotificationToUser(phone, content, orderId || event.params.orderId, "reservation_confirmed", deliveryMethod);
      return null;
    }

    console.log(
      `Order ${event.params.orderId} status changed: ${before.status} → ${after.status}`
    );

    // FUTURE ORDER LOGIC:
    // - If order has deliveryDateTime that is STILL in the future → Skip notification
    // - If order has deliveryDateTime that has PASSED (now due) → Send notification (normal behavior)
    // - If order has no deliveryDateTime → Send notification (normal behavior, regular order)
    // This ensures future orders only get notifications when their scheduled time arrives
    if (isFutureOrderNotYetDue(after)) {
      console.log(`Order ${event.params.orderId} is a future order (scheduled time hasn't arrived yet), skipping notification. Will notify when scheduled time arrives.`);
      return null;
    }

    const { status, phone, uid: orderId, deliveryMethod } = after;

    // Check if this was a future order that is now due
    const wasFutureOrder = isFutureOrderNowDue(after);

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

    // For EAT_IN: Only send "pending" and "ready"
    if (
      deliveryMethod === "eat_in" &&
      !["pending", "ready"].includes(status)
    ) {
      console.log(`Skipping "${status}" for eat-in order (not relevant)`);
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
      pending: (() => {
        if (wasFutureOrder) {
          // Future order that is now due
          return {
            ar: {
              title: "تم تأكيد طلبك المجدول 🎉",
              body: "رح نبدأ بتحضير طلبك حسب الموعد المحدد",
            },
            he: {
              title: "ההזמנה המתוזמנת אושרה 🎉",
              body: "נתחיל בהכנת ההזמנה שלך במועד שנקבע",
            },
          };
        } else if (deliveryMethod === "eat_in") {
          // Eat-in orders - no delivery/pickup time estimates
          return {
            ar: {
              title: "تم تأكيد طلبك 🎉",
              body: "سنبدأ بتحضير طلبك قريباً",
            },
            he: {
              title: "ההזמנה אושרה 🎉",
              body: "נתחיל בהכנת ההזמנה שלך בקרוב",
            },
          };
        } else if (deliveryMethod === "pickup") {
          // Pickup orders - ready for pickup time
          return {
            ar: {
              title: "تم تأكيد طلبك 🎉",
              body: "جاهز للاستلام خلال 30 دقيقة",
            },
            he: {
              title: "ההזמנה אושרה 🎉",
              body: "מוכן לאיסוף תוך 30 דקות",
            },
          };
        } else {
          // Delivery orders - delivery time estimate
          return {
            ar: {
              title: "تم تأكيد طلبك 🎉",
              body: "يصلك خلال 45 دقيقة",
            },
            he: {
              title: "ההזמנה אושרה 🎉",
              body: "מגיע תוך 45 דקות",
            },
          };
        }
      })(),
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

