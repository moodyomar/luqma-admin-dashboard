import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

/**
 * Helper: Send push notifications via Expo Push API
 */
async function sendExpoPushNotifications(messages: any[]) {
  const fetch = require("node-fetch");
  
  const chunks = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }
  
  for (const chunk of chunks) {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(chunk),
    });
    
    const data = await response.json();
    logger.info("Expo push response:", data);
  }
}

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
      
      // Check if order is assigned to a specific driver
      const assignedDriverId = afterData.assignedDriverId;
      
      let targetDriverIds: string[] = [];
      
      if (assignedDriverId) {
        // Order is assigned - notify only the assigned driver
        logger.info(`Order ${orderId} is assigned to driver ${assignedDriverId}, sending notification to assigned driver only`);
        targetDriverIds = [assignedDriverId];
      } else {
        // Order is unassigned - notify all drivers (backward compatibility)
        logger.info(`Order ${orderId} is unassigned, sending notification to all drivers`);
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
        
        targetDriverIds = driversSnapshot.docs.map(doc => doc.id);
        logger.info(`Found ${targetDriverIds.length} drivers for business ${businessId}`);
      }
      
      // Fetch push tokens for target driver(s)
      const tokens: string[] = [];
      const batchSize = 10;
      
      for (let i = 0; i < targetDriverIds.length; i += batchSize) {
        const batch = targetDriverIds.slice(i, i + batchSize);
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
        logger.warn(`No push tokens found for ${assignedDriverId ? 'assigned driver' : 'drivers'} in business ${businessId}`);
        return null;
      }
      
      // Remove duplicate tokens
      const uniqueTokens = [...new Set(tokens)];
      logger.info(`Found ${tokens.length} driver push tokens (${uniqueTokens.length} unique) for ${assignedDriverId ? 'assigned driver' : 'all drivers'}`);
      
      // Prepare notification based on status
      let title: string;
      let body: string;
      
      if (newStatus === "preparing") {
        title = "طلب جديد قيد التحضير 📦";
        body = `طلب جديد #${orderId.slice(0, 6)} - ${afterData.customerName || afterData.name || "عميل"}`;
      } else if (newStatus === "ready") {
        title = "طلب جاهز للتوصيل! ✅";
        body = `الطلب #${orderId.slice(0, 6)} جاهز الآن - ${afterData.address || ""}`;
      } else {
        return null;
      }
      
      // Prepare Expo push notification messages
      const messages = uniqueTokens.map((token: string) => ({
        to: token,
        sound: "default",
        title: title,
        body: body,
        data: {
          type: "order_status_change",
          orderId: orderId,
          businessId: businessId,
          status: newStatus,
        },
      }));
      
      // Send via Expo Push API
      await sendExpoPushNotifications(messages);
      
      logger.info(
        `Sent ${uniqueTokens.length} notifications to drivers for order ${orderId}`
      );
      
      return {
        success: true,
        sentTo: uniqueTokens.length,
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
      
      // Check if order is assigned to a specific driver
      const assignedDriverId = orderData.assignedDriverId;
      
      let targetDriverIds: string[] = [];
      
      if (assignedDriverId) {
        // Order is assigned - notify only the assigned driver
        logger.info(`New order ${orderId} is assigned to driver ${assignedDriverId}, sending notification to assigned driver only`);
        targetDriverIds = [assignedDriverId];
      } else {
        // Order is unassigned - notify all drivers (backward compatibility)
        logger.info(`New order ${orderId} is unassigned, sending notification to all drivers`);
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
        
        targetDriverIds = driversSnapshot.docs.map(doc => doc.id);
        logger.info(`Found ${targetDriverIds.length} drivers for business ${businessId}`);
      }
      
      // Fetch push tokens for target driver(s)
      const tokens: string[] = [];
      const batchSize = 10;
      
      for (let i = 0; i < targetDriverIds.length; i += batchSize) {
        const batch = targetDriverIds.slice(i, i + batchSize);
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
        logger.warn(`No push tokens found for ${assignedDriverId ? 'assigned driver' : 'drivers'} in business ${businessId}`);
        return null;
      }
      
      // Remove duplicate tokens
      const uniqueTokens = [...new Set(tokens)];
      logger.info(`Found ${tokens.length} driver push tokens for new order (${uniqueTokens.length} unique) for ${assignedDriverId ? 'assigned driver' : 'all drivers'}`);
      
      // Notification for new order
      const title = "طلب جديد! 🎉";
      const body = `طلب توصيل جديد - ${orderData.customerName || orderData.name || "عميل"}`;
      
      // Prepare Expo push notification messages
      const messages = uniqueTokens.map((token: string) => ({
        to: token,
        sound: "default",
        title: title,
        body: body,
        data: {
          type: "new_order",
          orderId: orderId,
          businessId: businessId,
          status: orderData.status,
        },
      }));
      
      // Send via Expo Push API
      await sendExpoPushNotifications(messages);
      
      logger.info(
        `Sent ${uniqueTokens.length} notifications to drivers for new order ${orderId}`
      );
      
      return {
        success: true,
        sentTo: uniqueTokens.length,
      };
    } catch (error) {
      logger.error("Error sending new order notification:", error);
      return null;
    }
  });

