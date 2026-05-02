import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";

/**
 * Helper: Check if order is a future order (not yet due)
 * Returns true if order has a deliveryDateTime that is still in the future
 * Returns false if order has no deliveryDateTime or if it's already due
 */
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
      logger.info("Invalid deliveryDateTime, treating as regular order");
      return false;
    }
    
    // Check if delivery date is still in the future
    const now = new Date();
    const isStillFuture = deliveryDate > now;
    
    if (isStillFuture) {
      logger.info(`Order has future deliveryDateTime: ${deliveryDate.toISOString()}, not yet due`);
    } else {
      logger.info(`Order deliveryDateTime has passed: ${deliveryDate.toISOString()}, order is now due`);
    }
    
    return isStillFuture;
  } catch (error) {
    logger.error("Error checking if order is future order:", error);
    // On error, treat as regular order (don't skip notification)
    return false;
  }
}

/** Zone labels for driver filtering: city fields + first segment of address ("city, street, ..."). */
function collectOrderCityCandidates(orderData: any): string[] {
  const variants: string[] = [];
  const pushRaw = (v: any) => {
    if (v == null) return;
    if (typeof v === "string") {
      const t = v.trim();
      if (t) variants.push(t);
      return;
    }
    if (typeof v === "object") {
      for (const k of ["he", "ar", "en"]) {
        const t = String((v as any)[k] || "").trim();
        if (t) variants.push(t);
      }
    }
  };
  pushRaw(orderData.city);
  pushRaw(orderData.deliveryCity);
  const addr = orderData.address;
  if (typeof addr === "string" && addr.trim()) {
    const first = addr.split(/[،,]/)[0]?.trim();
    if (first) variants.push(first);
  }
  const lower = variants.map((s) => s.toLowerCase());
  return [...new Set(lower)];
}

function orderCityMatchesAllowedZones(orderData: any, allowedCities: any[]): boolean {
  const candidates = collectOrderCityCandidates(orderData);
  if (candidates.length === 0) return false;
  return candidates.some((candidate) =>
    allowedCities.some((allowedCity: any) => {
      if (typeof allowedCity === "string") {
        return allowedCity.trim().toLowerCase() === candidate;
      }
      const cityHe = (allowedCity.he || "").trim().toLowerCase();
      const cityAr = (allowedCity.ar || "").trim().toLowerCase();
      const cityEn = (allowedCity.en || "").trim().toLowerCase();
      return (
        (cityHe && cityHe === candidate) ||
        (cityAr && cityAr === candidate) ||
        (cityEn && cityEn === candidate)
      );
    })
  );
}

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
  
  // FUTURE ORDER LOGIC:
  // - If order has deliveryDateTime that is STILL in the future → Skip notification
  // - If order has deliveryDateTime that has PASSED (now due) → Send notification (normal behavior)
  // - If order has no deliveryDateTime → Send notification (normal behavior, regular order)
  // This ensures future orders only get notifications when their scheduled time arrives
  if (isFutureOrderNotYetDue(afterData)) {
    logger.info(`Order ${orderId} is a future order (scheduled time hasn't arrived yet), skipping notification. Will notify when scheduled time arrives.`);
    return null;
  }
  
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
      
      const zoneCandidates = collectOrderCityCandidates(afterData);
      
      if (assignedDriverId) {
        // Order is assigned - notify only the assigned driver (skip city filtering for assigned orders)
        logger.info(`Order ${orderId} is assigned to driver ${assignedDriverId}, sending notification to assigned driver only`);
        targetDriverIds = [assignedDriverId];
      } else {
        // Order is unassigned - notify only drivers with matching delivery zones
        if (zoneCandidates.length === 0) {
          logger.warn(`Order ${orderId} has no city/address zone data, skipping driver notifications for unassigned order`);
          return null;
        }
        logger.info(`Order ${orderId} is unassigned, zone candidates: ${zoneCandidates.join(" | ")}`);
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
        
        // Filter drivers by allowed delivery cities (STRICT FILTERING)
        const eligibleDrivers: string[] = [];
        
        driversSnapshot.docs.forEach((driverDoc) => {
          const driverData = driverDoc.data();
          const allowedCities = driverData.allowedDeliveryCities || [];
          
          // STRICT: If driver has no allowed cities set, exclude them (no backward compatibility)
          if (allowedCities.length === 0) {
            logger.info(`Driver ${driverDoc.id} has no delivery zones set, excluding from notifications`);
            return;
          }
          
          const cityMatches = orderCityMatchesAllowedZones(afterData, allowedCities);
          
          if (cityMatches) {
            eligibleDrivers.push(driverDoc.id);
            logger.info(`Driver ${driverDoc.id} is eligible for order (zones match)`);
          } else {
            logger.info(`Driver ${driverDoc.id} is NOT eligible - order zones [${zoneCandidates.join(" | ")}] not in allowed list`);
          }
        });
        
        targetDriverIds = eligibleDrivers;
        logger.info(`Found ${targetDriverIds.length} eligible drivers (out of ${driversSnapshot.docs.length} total) for order zones: ${zoneCandidates.join(" | ")}`);
        
        if (targetDriverIds.length === 0) {
          logger.warn(`No drivers found with delivery zone matching order zones: ${zoneCandidates.join(" | ")}`);
          return null;
        }
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
    
    // FUTURE ORDER LOGIC:
    // - If order has deliveryDateTime in the future → Skip notification now
    // - If order has no deliveryDateTime OR deliveryDateTime has passed → Send notification (normal behavior)
    // - Regular orders (no deliveryDateTime) work exactly as before
    if (isFutureOrderNotYetDue(orderData)) {
      logger.info(`Order ${orderId} is a future order (scheduled for later), skipping immediate notification. Will notify when scheduled time arrives.`);
      return null;
    }
    
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
      
      const createZoneCandidates = collectOrderCityCandidates(orderData);
      
      if (assignedDriverId) {
        // Order is assigned - notify only the assigned driver (skip city filtering for assigned orders)
        logger.info(`New order ${orderId} is assigned to driver ${assignedDriverId}, sending notification to assigned driver only`);
        targetDriverIds = [assignedDriverId];
      } else {
        // Order is unassigned - notify only drivers with matching delivery zones
        if (createZoneCandidates.length === 0) {
          logger.warn(`New order ${orderId} has no city/address zone data, skipping driver notifications for unassigned order`);
          return null;
        }
        logger.info(`New order ${orderId} is unassigned, zone candidates: ${createZoneCandidates.join(" | ")}`);
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
        
        // Filter drivers by allowed delivery cities (STRICT FILTERING)
        const eligibleDrivers: string[] = [];
        
        driversSnapshot.docs.forEach((driverDoc) => {
          const driverData = driverDoc.data();
          const allowedCities = driverData.allowedDeliveryCities || [];
          
          // STRICT: If driver has no allowed cities set, exclude them (no backward compatibility)
          if (allowedCities.length === 0) {
            logger.info(`Driver ${driverDoc.id} has no delivery zones set, excluding from notifications`);
            return;
          }
          
          const cityMatches = orderCityMatchesAllowedZones(orderData, allowedCities);
          
          if (cityMatches) {
            eligibleDrivers.push(driverDoc.id);
            logger.info(`Driver ${driverDoc.id} is eligible for new order (zones match)`);
          } else {
            logger.info(`Driver ${driverDoc.id} is NOT eligible - order zones [${createZoneCandidates.join(" | ")}] not in allowed list`);
          }
        });
        
        targetDriverIds = eligibleDrivers;
        logger.info(`Found ${targetDriverIds.length} eligible drivers (out of ${driversSnapshot.docs.length} total) for new order zones: ${createZoneCandidates.join(" | ")}`);
        
        if (targetDriverIds.length === 0) {
          logger.warn(`No drivers found with delivery zone matching new order zones: ${createZoneCandidates.join(" | ")}`);
          return null;
        }
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

