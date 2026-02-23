import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";

/**
 * Cloud Function to send promotional notifications to users
 * Requires admin role to execute
 * Using Gen 2 functions (v2) to match other functions in the project
 */
export const sendPromotionalNotification = onCall(
  { enforceAppCheck: false },
  async (request) => {
    const data = request.data as {
      title: string;
      body: string;
      targetUsers: "all" | string[];
      businessId?: string;
    };
    const context = request.auth;
    
    // Authentication check
    if (!context) {
      throw new HttpsError(
        "unauthenticated",
        "You must be authenticated to send notifications"
      );
    }

    // Authorization check - ensure user has admin role
    const userRoles = context.token.roles || [];
    if (!userRoles.includes("admin")) {
      throw new HttpsError(
        "permission-denied",
        "Only admins can send promotional notifications"
      );
    }

    // Validate input
    if (!data.title || !data.body) {
      throw new HttpsError(
        "invalid-argument",
        "Title and body are required"
      );
    }

    if (data.title.length > 65) {
      throw new HttpsError(
        "invalid-argument",
        "Title must be 65 characters or less"
      );
    }

    if (data.body.length > 240) {
      throw new HttpsError(
        "invalid-argument",
        "Body must be 240 characters or less"
      );
    }

    try {
      const db = admin.firestore();
      const fetch = require("node-fetch");

      // Fetch Expo push tokens for all target users from the global users collection
      const tokens: string[] = [];
      let userDocs: admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>[] = [];

      // Determine target users
      if (data.targetUsers === "all") {
        // Get all users from the global users collection (where push tokens are stored)
        const usersSnapshot = await db
          .collection("users")
          .get();

        // Filter to only customer users (not drivers) with phone numbers
        userDocs = usersSnapshot.docs.filter(doc => {
          const userData = doc.data();
          
          // Must have a phone number (real customer)
          if (!userData.phone || !userData.phone.trim()) {
            return false;
          }
          
          // Check if user has any driver tokens - if so, exclude them
          if (userData.pushTokens && Array.isArray(userData.pushTokens)) {
            const hasDriverTokens = userData.pushTokens.some((tokenObj: any) => 
              tokenObj.active && tokenObj.appType === 'driver'
            );
            if (hasDriverTokens) {
              return false; // Exclude drivers
            }
          }
          
          return true; // Include customer users
        });
        
        logger.info(`Sending notification to all customer users: ${userDocs.length} users (filtered out drivers and users without phone numbers)`);
      } else if (Array.isArray(data.targetUsers)) {
        const userIds = data.targetUsers;
        logger.info(`Sending notification to specific users: ${userIds.length} users`);
        
        if (userIds.length === 0) {
          return {
            success: true,
            sentTo: 0,
            message: "No users to send notifications to"
          };
        }

        // Fetch specific users in batches (Firestore 'in' query limit is 10)
        const batchSize = 10;
        for (let i = 0; i < userIds.length; i += batchSize) {
          const batch = userIds.slice(i, i + batchSize);
          const batchDocs = await db
            .collection("users")
            .where(admin.firestore.FieldPath.documentId(), "in", batch)
            .get();
          
          userDocs.push(...batchDocs.docs);
        }
      } else {
        throw new HttpsError(
          "invalid-argument",
          "targetUsers must be 'all' or an array of user IDs"
        );
      }

      if (userDocs.length === 0) {
        return {
          success: true,
          sentTo: 0,
          message: "No users to send notifications to"
        };
      }

      // Extract tokens from all user documents
      // IMPORTANT: Separate tokens by app type to avoid mixing different Expo projects
      // Expo requires all tokens in a batch to be from the same project
      const customerAppTokens: string[] = [];
      const driverAppTokens: string[] = [];
      let usersWithNoTokens = 0;
      let usersWithDriverTokens = 0;
      let usersWithCustomerTokens = 0;
      
      userDocs.forEach((doc) => {
        const userData = doc.data();
        const userId = doc.id;
        const userPhone = userData.phone || 'no phone';
        
        // IMPORTANT: Extract ONLY customer app tokens from each user
        // Do NOT skip users who have driver tokens - we still want to send to their customer tokens
        // Only exclude tokens where appType === 'driver'
        let userCustomerTokenCount = 0;
        let userDriverTokenCount = 0;
        
        if (userData.pushTokens && Array.isArray(userData.pushTokens)) {
          userData.pushTokens.forEach((tokenObj: any) => {
            // Only process active Expo push tokens
            if (tokenObj.active && tokenObj.token && tokenObj.token.startsWith("ExponentPushToken")) {
              // CRITICAL: Only include customer app tokens
              // Include if appType is undefined/null OR appType is 'customer'
              // Exclude if appType is 'driver' or any other value
              if (!tokenObj.appType || tokenObj.appType === 'customer') {
                customerAppTokens.push(tokenObj.token);
                userCustomerTokenCount++;
              } else if (tokenObj.appType === 'driver') {
                // This is a driver token - exclude it
                driverAppTokens.push(tokenObj.token);
                userDriverTokenCount++;
              } else {
                // Unknown appType - exclude it to be safe
                logger.warn(`[USER ${userId}] Excluding token with unknown appType: ${tokenObj.appType}`);
              }
            }
          });
        }
        // Fallback to old single token fields (Expo tokens) - assume customer app (backward compatibility)
        else if (userData.pushToken && userData.pushToken.startsWith("ExponentPushToken")) {
          customerAppTokens.push(userData.pushToken);
          userCustomerTokenCount++;
        } else if (userData.fcmToken && userData.fcmToken.startsWith("ExponentPushToken")) {
          customerAppTokens.push(userData.fcmToken);
          userCustomerTokenCount++;
        }
        
        if (userCustomerTokenCount > 0) {
          usersWithCustomerTokens++;
          if (userDriverTokenCount > 0) {
            logger.info(`[USER ${userId}] Phone: ${userPhone} - Added ${userCustomerTokenCount} customer token(s), excluded ${userDriverTokenCount} driver token(s)`);
          } else {
            logger.info(`[USER ${userId}] Phone: ${userPhone} - Added ${userCustomerTokenCount} customer token(s)`);
          }
        } else {
          if (userDriverTokenCount > 0) {
            usersWithDriverTokens++;
            logger.warn(`[USER ${userId}] Phone: ${userPhone} - Only driver tokens found (${userDriverTokenCount}), no customer tokens`);
          } else {
            usersWithNoTokens++;
            logger.warn(`[USER ${userId}] Phone: ${userPhone} - No active tokens found`);
          }
        }
      });
      
      // Use ONLY customer app tokens (promotional notifications are for customers)
      // Do NOT mix with driver app tokens
      tokens.push(...customerAppTokens);
      
      logger.info(`[TOKEN_FILTER] ========== TOKEN FILTERING SUMMARY ==========`);
      logger.info(`[TOKEN_FILTER] Processed ${userDocs.length} users`);
      logger.info(`[TOKEN_FILTER] Users with customer tokens: ${usersWithCustomerTokens}`);
      logger.info(`[TOKEN_FILTER] Users with driver tokens (excluded): ${usersWithDriverTokens}`);
      logger.info(`[TOKEN_FILTER] Users with no tokens: ${usersWithNoTokens}`);
      logger.info(`[TOKEN_FILTER] Found ${customerAppTokens.length} customer app tokens`);
      logger.info(`[TOKEN_FILTER] Found ${driverAppTokens.length} driver app tokens (excluded)`);
      logger.info(`[TOKEN_FILTER] Using ${tokens.length} customer app tokens for notification`);

      if (tokens.length === 0) {
        logger.warn("[TOKEN_FILTER] ❌ No customer app tokens found!");
        logger.warn(`[TOKEN_FILTER] This could mean:`);
        logger.warn(`[TOKEN_FILTER] 1. All users are drivers (have driver tokens)`);
        logger.warn(`[TOKEN_FILTER] 2. No users have active push tokens`);
        logger.warn(`[TOKEN_FILTER] 3. All tokens are inactive`);
        return {
          success: true,
          sentTo: 0,
          failed: 0,
          totalTokens: 0,
          message: "No users have push notifications enabled",
          debug: {
            totalUsers: userDocs.length,
            usersWithCustomerTokens,
            usersWithDriverTokens,
            usersWithNoTokens,
            customerTokensFound: customerAppTokens.length,
            driverTokensFound: driverAppTokens.length
          }
        };
      }
      
      logger.info(`[TOKEN_FILTER] ✅ Proceeding to send ${tokens.length} notifications`);

      // Prepare Expo push notification messages for customer app tokens only
      const customerMessages = tokens.map((token: string) => ({
        to: token,
        sound: "default",
        title: data.title,
        body: data.body,
        data: {
          type: "promotional",
          timestamp: new Date().toISOString(),
        },
        channelId: "default",
      }));

      // Send via Expo Push API
      // IMPORTANT: Expo requires tokens from the same project in each batch
      // We've already filtered to only customer app tokens
      let successCount = 0;
      let failureCount = 0;

      // Expo limits to 100 notifications per request
      const chunks = [];
      for (let i = 0; i < customerMessages.length; i += 100) {
        chunks.push(customerMessages.slice(i, i + 100));
      }

      logger.info(`Sending ${customerMessages.length} customer app messages in ${chunks.length} chunk(s)`);

      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];
        try {
          logger.info(`Sending chunk ${chunkIndex + 1}/${chunks.length} with ${chunk.length} messages`);
          
          const response = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Accept-Encoding": "gzip, deflate",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(chunk),
          });

          if (!response.ok) {
            logger.error(`Expo API error: ${response.status} ${response.statusText}`);
            failureCount += chunk.length;
            continue;
          }

          const result = await response.json();
          logger.info(`Chunk ${chunkIndex + 1} response:`, JSON.stringify(result, null, 2));

          // Check for errors in response
          if (result.errors && result.errors.length > 0) {
            result.errors.forEach((error: any) => {
              logger.error(`Expo API error: ${error.code} - ${error.message}`);
              if (error.details) {
                logger.error(`Error details:`, JSON.stringify(error.details, null, 2));
              }
            });
          }

          // Count successes and failures from Expo response
          if (Array.isArray(result.data)) {
            result.data.forEach((item: any) => {
              if (item.status === "ok") {
                successCount++;
              } else {
                failureCount++;
                logger.error(`Failed to send to token: ${item.message || "Unknown error"}`);
              }
            });
          } else {
            // If no data array, assume all failed
            failureCount += chunk.length;
          }
        } catch (error) {
          logger.error(`Error sending chunk ${chunkIndex + 1} to Expo:`, error);
          failureCount += chunk.length;
        }
      }

      logger.info(`[NOTIFICATION_RESULT] ========== NOTIFICATION RESULT ==========`);
      logger.info(`[NOTIFICATION_RESULT] Total tokens: ${tokens.length}`);
      logger.info(`[NOTIFICATION_RESULT] Successfully sent: ${successCount}`);
      logger.info(`[NOTIFICATION_RESULT] Failed: ${failureCount}`);
      
      if (successCount === 0 && failureCount === 0) {
        logger.error(`[NOTIFICATION_RESULT] ❌ No notifications were sent!`);
        logger.error(`[NOTIFICATION_RESULT] This usually means Expo API rejected all tokens`);
        logger.error(`[NOTIFICATION_RESULT] Check for PUSH_TOO_MANY_EXPERIENCE_IDS error above`);
      } else if (successCount === 0) {
        logger.error(`[NOTIFICATION_RESULT] ❌ All ${failureCount} notifications failed!`);
      } else {
        logger.info(`[NOTIFICATION_RESULT] ✅ Successfully sent to ${successCount} users`);
      }

      return {
        success: true,
        sentTo: successCount,
        failed: failureCount,
        totalTokens: tokens.length,
        message: `Notification sent successfully to ${successCount} users`,
        debug: {
          totalUsers: userDocs.length,
          usersWithCustomerTokens,
          usersWithDriverTokens,
          usersWithNoTokens,
          customerTokensFound: customerAppTokens.length,
          driverTokensFound: driverAppTokens.length,
          chunksSent: chunks.length
        }
      };
    } catch (error) {
      logger.error("Error sending promotional notification:", error);
      throw new HttpsError(
        "internal",
        "Failed to send notification",
        error instanceof Error ? error.message : String(error)
      );
    }
  }
);

