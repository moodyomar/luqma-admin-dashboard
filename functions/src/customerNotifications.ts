import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import {
  sendLocalizedExpoToCustomerByPhone,
  type LocalizedPushContent,
} from "./customerExpoPush";

/**
 * CUSTOMER NOTIFICATIONS — single deployed implementation (admin-dashboard/functions).
 * Behavior is kept in parity with menu-app/functions (order create + status + reservations).
 * Deploy with: `firebase deploy --only functions:onOrderCreated,functions:onOrderStatusChange`
 * Do not deploy menu-app Cloud Functions to the same project (duplicate triggers / drift).
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

async function sendNotificationToUser(
  phone: string,
  content: LocalizedPushContent,
  orderId: string,
  status: string,
  deliveryMethod: string
) {
  await sendLocalizedExpoToCustomerByPhone({
    phone,
    content,
    data: { orderId, status, deliveryMethod, screen: orderId ? "MyOrdersScreen" : "ProfileTab" },
    log: { orderId, status, deliveryMethod },
  });
}

// ==========================================
// 1. NEW ORDER CREATED → SEND "ORDER CONFIRMED" TO CUSTOMER
// ==========================================
export const onOrderCreated = onDocumentCreated("menus/{brandId}/orders/{orderId}", async (event) => {
  if (!event.data) return null;

  const snap = event.data;
  const order = snap.data();
  const orderId = event.params.orderId;
  const { phone, deliveryMethod } = order;

  console.log(`New order created: ${orderId}`);

  if (!phone || String(phone).trim() === "") {
    console.warn("onOrderCreated: Order has no phone — cannot send customer notification");
    return null;
  }

  // Table reservation request (eat-in flow): different copy from standard "order confirmed"
  if (order.reservationStatus === "reservation_request") {
    const dt = order.deliveryDateTime;
    let dateTimeStr = "";
    if (dt) {
      try {
        const d =
          dt && typeof dt.toDate === "function" ? dt.toDate() : new Date(dt);
        if (!isNaN(d.getTime())) {
          const date = d.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          });
          const time = d.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
          dateTimeStr = ` ${date} ${time}`;
        }
      } catch {
        /* ignore */
      }
    }
    const content: LocalizedPushContent = {
      ar: {
        title: "تم إرسال طلب حجز الطاولة",
        body: `طلب حجز الطاولة لـ${dateTimeStr} تم إرساله. سنعلمك عندما يرد المطعم.`,
      },
      he: {
        title: "נשלחה בקשת הזמנת שולחן",
        body: `בקשת הזמנת השולחן ל${dateTimeStr} נשלחה. נעדכן כשהמסעדה תאשר.`,
      },
    };
    await sendNotificationToUser(
      phone,
      content,
      orderId,
      "reservation_request_sent",
      "eat_in"
    );
    return null;
  }

  // FUTURE ORDER: skip immediate "30 min / 45 min" notifications until due
  if (isFutureOrderNotYetDue(order)) {
    console.log(
      `Order ${orderId} is a future order (scheduled for later), skipping immediate notification.`
    );
    return null;
  }

  const wasFutureOrder = isFutureOrderNowDue(order);

  let content: LocalizedPushContent;

  if (wasFutureOrder) {
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
    orderId,
    "pending",
    deliveryMethod || ""
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

  // --- Reservation workflow (eat-in): notify on reservationStatus alone ---
  if (before.reservationStatus !== after.reservationStatus) {
    const newReservationStatus = after.reservationStatus;
    if (
      newReservationStatus === "reservation_confirmed" ||
      newReservationStatus === "alternatives_sent" ||
      newReservationStatus === "reservation_declined"
    ) {
      const orderId = event.params.orderId;
      const { phone, deliveryMethod } = after;
      let content: LocalizedPushContent;
      if (newReservationStatus === "reservation_confirmed") {
        const dt = after.deliveryDateTime;
        let dateTimeStr = "";
        if (dt) {
          try {
            const d =
              dt && typeof dt.toDate === "function"
                ? dt.toDate()
                : new Date(dt);
            if (!isNaN(d.getTime())) {
              const date = d.toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              });
              const time = d.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              });
              dateTimeStr = ` ${date} ${time}`;
            }
          } catch {
            /* ignore */
          }
        }
        content = {
          ar: {
            title: "تم تأكيد حجز الطاولة",
            body: `حجز طاولتك لـ${dateTimeStr} مؤكد. افتح التطبيق واختر طريقة الدفع.`,
          },
          he: {
            title: "הזמנת השולחן אושרה",
            body: `הזמנת השולחן שלך ל${dateTimeStr} אושרה. פתח את האפליקציה ובחר אמצעי תשלום.`,
          },
        };
      } else if (newReservationStatus === "alternatives_sent") {
        content = {
          ar: {
            title: "المطعم اقترح أوقاتاً بديلة",
            body:
              "الوقت المطلوب غير متاح. افتح التطبيق واختر أحد الأوقات المقترحة ثم ادفع.",
          },
          he: {
            title: "המסעדה הציעה מועדים חלופיים",
            body:
              "המועד המבוקש לא זמין. פתח את האפליקציה ובחר אחד מהמועדים ואז שלם.",
          },
        };
      } else {
        content = {
          ar: {
            title: "لم نتمكن من تأكيد حجزك",
            body:
              "للأسف لم نتمكن من تلبية الموعد المطلوب. جرب تاريخاً آخر أو تواصل معنا.",
          },
          he: {
            title: "לא הצלחנו לאשר את ההזמנה",
            body:
              "לצערנו לא יכולנו לעמוד במועד המבוקש. נסה תאריך אחר או צור קשר.",
          },
        };
      }
      if (phone && String(phone).trim() !== "") {
        await sendNotificationToUser(
          phone,
          content,
          orderId,
          `reservation_${newReservationStatus}`,
          deliveryMethod || "eat_in"
        );
      }
      console.log(
        `✅ Sent reservation notification for order ${orderId}, reservationStatus: ${newReservationStatus}`
      );
      return null;
    }
  }

  // Check if table was assigned (for future order reservations)
  const tableWasAssigned =
    !before.tableNumber && after.tableNumber && after.reservationConfirmed;
  const isFutureReservation = tableWasAssigned && isFutureOrderNotYetDue(after);

  // Only trigger if status actually changed OR table was assigned
  if (before.status === after.status && !tableWasAssigned) {
    console.log("Status unchanged and no table assigned, skipping notification");
    return null;
  }

  // If table was assigned for a future reservation, send notification
  if (isFutureReservation) {
    const { phone, uid: orderUid, tableNumber, deliveryMethod } = after;
    console.log(`Table ${tableNumber} assigned for future reservation ${orderUid}`);

    const tableContent: LocalizedPushContent = {
      ar: {
        title: "تم تأكيد حجزك 🎉",
        body: `تم تعيين طاولة رقم ${tableNumber} لك. سنبدأ التحضير حسب الموعد المحدد.`,
      },
      he: {
        title: "ההזמנה אושרה 🎉",
        body: `שולחן מספר ${tableNumber} הוקצה עבורך. נתחיל בהכנה במועד שנקבע.`,
      },
    };

    await sendNotificationToUser(
      phone,
      tableContent,
      orderUid || event.params.orderId,
      "reservation_confirmed",
      deliveryMethod || ""
    );
    return null;
  }

    console.log(
      `Order ${event.params.orderId} status changed: ${before.status} → ${after.status}`
    );

    // FUTURE ORDER: skip until scheduled time
    if (isFutureOrderNotYetDue(after)) {
      console.log(
        `Order ${event.params.orderId} is a future order (scheduled time hasn't arrived yet), skipping notification.`
      );
      return null;
    }

    const { status, phone, uid: orderId, deliveryMethod } = after;

    const wasFutureOrder = isFutureOrderNowDue(after);

    if (status === "preparing") {
      console.log('Skipping "preparing" notification (not important)');
      return null;
    }

    // menu-app parity: eat-in includes completed/served; pickup & delivery include terminal states
    if (
      deliveryMethod === "eat_in" &&
      !["pending", "ready", "served", "completed"].includes(status)
    ) {
      console.log(`Skipping "${status}" for eat-in order (not relevant)`);
      return null;
    }

    if (
      deliveryMethod === "pickup" &&
      !["pending", "ready", "completed", "delivered", "served"].includes(status)
    ) {
      console.log(`Skipping "${status}" for pickup order (not relevant)`);
      return null;
    }

    if (
      deliveryMethod === "delivery" &&
      ![
        "pending",
        "out_for_delivery",
        "delivered",
        "completed",
        "served",
      ].includes(status)
    ) {
      console.log(`Skipping "${status}" for delivery order (not relevant)`);
      return null;
    }

    // Notification content (Arabic & Hebrew) for CUSTOMERS — keep in sync with menu-app/functions
    const notifications: Record<string, LocalizedPushContent> = {
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
      completed: {
        ar: {
          title: "تم إكمال طلبك ✅",
          body: "شكراً لك! نتمنى أن تستمتع بوجبتك",
        },
        he: {
          title: "ההזמנה הושלמה ✅",
          body: "תודה! נקווה שתיהנה מהארוחה",
        },
      },
      served: {
        ar: {
          title: "تم تقديم طلبك ✅",
          body: "شكراً لك! نتمنى أن تستمتع بوجبتك",
        },
        he: {
          title: "ההזמנה הוגשה ✅",
          body: "תודה! נקווה שתיהנה מהארוחה",
        },
      },
    };

    let notif: LocalizedPushContent | undefined = notifications[status];
    if (!notif) {
      console.log("No notification template for status:", status);
      return null;
    }

    if (!phone || String(phone).trim() === "") {
      console.warn("onOrderStatusChange: no phone on order, skip customer push");
      return null;
    }

    await sendNotificationToUser(
      phone,
      notif,
      orderId || event.params.orderId,
      status,
      deliveryMethod || ""
    );
    
    return null;
  });

