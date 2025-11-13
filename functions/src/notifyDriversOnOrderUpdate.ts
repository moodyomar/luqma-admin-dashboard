import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

/**
 * Cloud Function to automatically notify DRIVERS when order status changes
 * Triggers on: order status changes to "preparing" or "ready"
 * Only notifies for delivery orders
 * SEPARATE from customer notifications (onOrderStatusChange)
 */
export const notifyDriversOnStatusChange = onDocumentUpdated("menus/{businessId}/orders/{orderId}", async (event) => {
  if (!event.data) return null;
  
  const change = event.data;
  const businessId = event.params.businessId;
  const orderId = event.params.orderId;
  
  const beforeData = change.before.data();
  const afterData = change.after.data();
  
  // Check if status changed
  if (beforeData.status === afterData.status) {
    logger.info("Status unchanged, skipping notification");
    return null;
  }
  
  const newStatus = afterData.status;
  const deliveryMethod = afterData.deliveryMethod;
  
  // Only notify for delivery orders
  if (deliveryMethod !== "delivery") {
    logger.info(`Order ${orderId} is not a delivery order, skipping notification`);
    return null;
  }
  
  // Only notify when status changes to "preparing" or "ready"
  if (newStatus !== "preparing" && newStatus !== "ready") {
    logger.info(`Status is ${newStatus}, not preparing/ready, skipping notification`);
    return null;
  }
    
    try {
      const db = admin.firestore();
      const messaging = admin.messaging();
      
      // Get all drivers for this business
      const driversSnapshot = await db
        .collection("menus")
        .doc(businessId)
        .collection("users")
        .where("role", "==", "driver")
        .get();
      
      if (driversSnapshot.empty) {
        logger.warn(`No drivers found for business ${businessId}`);
        return null;
      }
      
      const driverIds = driversSnapshot.docs.map(doc => doc.id);
      logger.info(`Found ${driverIds.length} drivers for business ${businessId}`);
      
      // Fetch push tokens for all drivers
      const tokens: string[] = [];
      const batchSize = 10;
      
      for (let i = 0; i < driverIds.length; i += batchSize) {
        const batch = driverIds.slice(i, i + batchSize);
        const userDocs = await db
          .collection("users")
          .where(admin.firestore.FieldPath.documentId(), "in", batch)
          .get();
        
        userDocs.forEach((doc) => {
          const userData = doc.data();
          
          // Check for pushTokens array (new structure)
          if (userData.pushTokens && Array.isArray(userData.pushTokens)) {
            userData.pushTokens.forEach((tokenObj: any) => {
              // Only add active driver tokens
              if (tokenObj.active && tokenObj.token && tokenObj.appType === "driver") {
                tokens.push(tokenObj.token);
              }
            });
          }
        });
      }
      
      if (tokens.length === 0) {
        logger.warn(`No push tokens found for drivers in business ${businessId}`);
        return null;
      }
      
      logger.info(`Found ${tokens.length} driver push tokens`);
      
      // Prepare notification based on status
      let title: string;
      let body: string;
      let sound: string = "default";
      
      if (newStatus === "preparing") {
        title = "طلب جديد قيد التحضير 📦";
        body = `طلب جديد #${orderId.slice(0, 6)} - ${afterData.customerName || afterData.name || "عميل"}`;
      } else if (newStatus === "ready") {
        title = "طلب جاهز للتوصيل! ✅";
        body = `الطلب #${orderId.slice(0, 6)} جاهز الآن - ${afterData.address || ""}`;
        sound = "luqma.mp3"; // Custom sound for ready orders
      } else {
        return null;
      }
      
      // Prepare notification payload
      const message: admin.messaging.MulticastMessage = {
        notification: {
          title,
          body,
        },
        data: {
          type: "order_status_change",
          orderId: orderId,
          businessId: businessId,
          status: newStatus,
          customerName: afterData.customerName || afterData.name || "",
          address: afterData.address || "",
          total: String(afterData.total || afterData.price || 0),
          timestamp: new Date().toISOString(),
        },
        tokens: tokens,
        android: {
          priority: "high",
          notification: {
            sound: sound,
            clickAction: "FLUTTER_NOTIFICATION_CLICK",
            channelId: "default",
            priority: "high" as any,
          },
        },
        apns: {
          payload: {
            aps: {
              sound: sound,
              badge: 1,
              alert: {
                title,
                body,
              },
              "content-available": 1,
            },
          },
        },
      };
      
      // Send the notification
      const response = await messaging.sendEachForMulticast(message);
      
      logger.info(
        `Notification sent for order ${orderId}. Success: ${response.successCount}, Failed: ${response.failureCount}`
      );
      
      // Log failed tokens for debugging
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            logger.error(
              `Failed to send to token ${tokens[idx]}: ${resp.error?.message}`
            );
          }
        });
      }
      
      return {
        success: true,
        sentTo: response.successCount,
        failed: response.failureCount,
      };
    } catch (error) {
      logger.error("Error sending driver notification:", error);
      // Don't throw error to avoid retries
      return null;
    }
  });

/**
 * Cloud Function to notify DRIVERS when a NEW delivery order is created
 * This handles the initial order creation (usually status: "pending" or "preparing")
 * SEPARATE from customer notifications (onOrderCreated)
 */
export const notifyDriversOnCreate = onDocumentCreated("menus/{businessId}/orders/{orderId}", async (event) => {
  if (!event.data) return null;
  
  const snap = event.data;
  const businessId = event.params.businessId;
  const orderId = event.params.orderId;
  const orderData = snap.data();
    
    // Only notify for delivery orders
    if (orderData.deliveryMethod !== "delivery") {
      logger.info(`Order ${orderId} is not a delivery order, skipping notification`);
      return null;
    }
    
    // Only notify if order is already in "preparing" status on creation
    if (orderData.status !== "preparing") {
      logger.info(`New order ${orderId} has status ${orderData.status}, not preparing, skipping notification`);
      return null;
    }
    
    try {
      const db = admin.firestore();
      const messaging = admin.messaging();
      
      // Get all drivers for this business
      const driversSnapshot = await db
        .collection("menus")
        .doc(businessId)
        .collection("users")
        .where("role", "==", "driver")
        .get();
      
      if (driversSnapshot.empty) {
        logger.warn(`No drivers found for business ${businessId}`);
        return null;
      }
      
      const driverIds = driversSnapshot.docs.map(doc => doc.id);
      
      // Fetch push tokens
      const tokens: string[] = [];
      const batchSize = 10;
      
      for (let i = 0; i < driverIds.length; i += batchSize) {
        const batch = driverIds.slice(i, i + batchSize);
        const userDocs = await db
          .collection("users")
          .where(admin.firestore.FieldPath.documentId(), "in", batch)
          .get();
        
        userDocs.forEach((doc) => {
          const userData = doc.data();
          
          if (userData.pushTokens && Array.isArray(userData.pushTokens)) {
            userData.pushTokens.forEach((tokenObj: any) => {
              if (tokenObj.active && tokenObj.token && tokenObj.appType === "driver") {
                tokens.push(tokenObj.token);
              }
            });
          }
        });
      }
      
      if (tokens.length === 0) {
        logger.warn(`No push tokens found for drivers in business ${businessId}`);
        return null;
      }
      
      logger.info(`Found ${tokens.length} driver push tokens for new order`);
      
      // Notification for new order
      const title = "طلب جديد! 🎉";
      const body = `طلب توصيل جديد - ${orderData.customerName || orderData.name || "عميل"}`;
      
      const message: admin.messaging.MulticastMessage = {
        notification: {
          title,
          body,
        },
        data: {
          type: "new_order",
          orderId: orderId,
          businessId: businessId,
          status: orderData.status,
          customerName: orderData.customerName || orderData.name || "",
          address: orderData.address || "",
          total: String(orderData.total || orderData.price || 0),
          timestamp: new Date().toISOString(),
        },
        tokens: tokens,
        android: {
          priority: "high",
          notification: {
            sound: "default",
            clickAction: "FLUTTER_NOTIFICATION_CLICK",
            channelId: "default",
            priority: "high" as any,
          },
        },
        apns: {
          payload: {
            aps: {
              sound: "default",
              badge: 1,
              alert: {
                title,
                body,
              },
              "content-available": 1,
            },
          },
        },
      };
      
      const response = await messaging.sendEachForMulticast(message);
      
      logger.info(
        `New order notification sent. Success: ${response.successCount}, Failed: ${response.failureCount}`
      );
      
      return {
        success: true,
        sentTo: response.successCount,
        failed: response.failureCount,
      };
    } catch (error) {
      logger.error("Error sending new order notification:", error);
      return null;
    }
  });

