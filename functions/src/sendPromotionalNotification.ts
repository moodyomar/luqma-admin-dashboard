import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

interface SendNotificationRequest {
  title: string;
  body: string;
  targetUsers: "all" | string[];
  businessId?: string;
}

/**
 * Cloud Function to send promotional notifications to users
 * Requires admin role to execute
 */
export const sendPromotionalNotification = functions.https.onCall(
  async (data: SendNotificationRequest, context) => {
    // Authentication check
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be authenticated to send notifications"
      );
    }

    // Authorization check - ensure user has admin role
    const userRoles = context.auth.token.roles || [];
    if (!userRoles.includes("admin")) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Only admins can send promotional notifications"
      );
    }

    // Validate input
    if (!data.title || !data.body) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Title and body are required"
      );
    }

    if (data.title.length > 65) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Title must be 65 characters or less"
      );
    }

    if (data.body.length > 240) {
      throw new functions.https.HttpsError(
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
        
        functions.logger.info(`Sending notification to all customer users: ${userDocs.length} users (filtered out drivers and users without phone numbers)`);
      } else if (Array.isArray(data.targetUsers)) {
        const userIds = data.targetUsers;
        functions.logger.info(`Sending notification to specific users: ${userIds.length} users`);
        
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
        throw new functions.https.HttpsError(
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
        
        // First, check if this user has ANY driver tokens
        // If they do, we'll exclude ALL their tokens to be safe
        let hasDriverTokens = false;
        if (userData.pushTokens && Array.isArray(userData.pushTokens)) {
          hasDriverTokens = userData.pushTokens.some((tokenObj: any) => 
            tokenObj.active && tokenObj.appType === 'driver'
          );
        }
        
        // If user has driver tokens, skip all their tokens
        if (hasDriverTokens) {
          usersWithDriverTokens++;
          functions.logger.info(`[USER ${userId}] Phone: ${userPhone} - Has driver tokens, skipping`);
          if (userData.pushTokens && Array.isArray(userData.pushTokens)) {
            userData.pushTokens.forEach((tokenObj: any) => {
              if (tokenObj.active && tokenObj.token && tokenObj.token.startsWith("ExponentPushToken")) {
                driverAppTokens.push(tokenObj.token);
              }
            });
          }
          return; // Skip this user entirely
        }
        
        // User doesn't have driver tokens, so include their customer tokens
        let userTokenCount = 0;
        if (userData.pushTokens && Array.isArray(userData.pushTokens)) {
          userData.pushTokens.forEach((tokenObj: any) => {
            // Only add active tokens (Expo push tokens start with "ExponentPushToken")
            if (tokenObj.active && tokenObj.token && tokenObj.token.startsWith("ExponentPushToken")) {
              // Only include if appType is NOT 'driver' (customer or undefined)
              if (tokenObj.appType !== 'driver') {
                customerAppTokens.push(tokenObj.token);
                userTokenCount++;
              } else {
                driverAppTokens.push(tokenObj.token);
              }
            }
          });
        }
        // Fallback to old single token fields (Expo tokens) - assume customer app
        else if (userData.pushToken && userData.pushToken.startsWith("ExponentPushToken")) {
          customerAppTokens.push(userData.pushToken);
          userTokenCount++;
        } else if (userData.fcmToken && userData.fcmToken.startsWith("ExponentPushToken")) {
          customerAppTokens.push(userData.fcmToken);
          userTokenCount++;
        }
        
        if (userTokenCount > 0) {
          usersWithCustomerTokens++;
          functions.logger.info(`[USER ${userId}] Phone: ${userPhone} - Added ${userTokenCount} customer token(s)`);
        } else {
          usersWithNoTokens++;
          functions.logger.warn(`[USER ${userId}] Phone: ${userPhone} - No active customer tokens found`);
        }
      });
      
      // Use ONLY customer app tokens (promotional notifications are for customers)
      // Do NOT mix with driver app tokens
      tokens.push(...customerAppTokens);
      
      functions.logger.info(`[TOKEN_FILTER] ========== TOKEN FILTERING SUMMARY ==========`);
      functions.logger.info(`[TOKEN_FILTER] Processed ${userDocs.length} users`);
      functions.logger.info(`[TOKEN_FILTER] Users with customer tokens: ${usersWithCustomerTokens}`);
      functions.logger.info(`[TOKEN_FILTER] Users with driver tokens (excluded): ${usersWithDriverTokens}`);
      functions.logger.info(`[TOKEN_FILTER] Users with no tokens: ${usersWithNoTokens}`);
      functions.logger.info(`[TOKEN_FILTER] Found ${customerAppTokens.length} customer app tokens`);
      functions.logger.info(`[TOKEN_FILTER] Found ${driverAppTokens.length} driver app tokens (excluded)`);
      functions.logger.info(`[TOKEN_FILTER] Using ${tokens.length} customer app tokens for notification`);

      if (tokens.length === 0) {
        functions.logger.warn("[TOKEN_FILTER] ❌ No customer app tokens found!");
        functions.logger.warn(`[TOKEN_FILTER] This could mean:`);
        functions.logger.warn(`[TOKEN_FILTER] 1. All users are drivers (have driver tokens)`);
        functions.logger.warn(`[TOKEN_FILTER] 2. No users have active push tokens`);
        functions.logger.warn(`[TOKEN_FILTER] 3. All tokens are inactive`);
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
      
      functions.logger.info(`[TOKEN_FILTER] ✅ Proceeding to send ${tokens.length} notifications`);

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
      // We've already filtered to only customer app tokens, so all should be from @devmoody/luqma
      let successCount = 0;
      let failureCount = 0;

      // Expo limits to 100 notifications per request
      const chunks = [];
      for (let i = 0; i < customerMessages.length; i += 100) {
        chunks.push(customerMessages.slice(i, i + 100));
      }

      functions.logger.info(`Sending ${customerMessages.length} customer app messages in ${chunks.length} chunk(s)`);

      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];
        try {
          functions.logger.info(`Sending chunk ${chunkIndex + 1}/${chunks.length} with ${chunk.length} messages`);
          
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
            functions.logger.error(`Expo API error: ${response.status} ${response.statusText}`);
            failureCount += chunk.length;
            continue;
          }

          const result = await response.json();
          functions.logger.info(`Chunk ${chunkIndex + 1} response:`, JSON.stringify(result, null, 2));

          // Check for errors in response
          if (result.errors && result.errors.length > 0) {
            result.errors.forEach((error: any) => {
              functions.logger.error(`Expo API error: ${error.code} - ${error.message}`);
              if (error.details) {
                functions.logger.error(`Error details:`, JSON.stringify(error.details, null, 2));
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
                functions.logger.error(`Failed to send to token: ${item.message || "Unknown error"}`);
              }
            });
          } else {
            // If no data array, assume all failed
            failureCount += chunk.length;
          }
        } catch (error) {
          functions.logger.error(`Error sending chunk ${chunkIndex + 1} to Expo:`, error);
          failureCount += chunk.length;
        }
      }

      functions.logger.info(`[NOTIFICATION_RESULT] ========== NOTIFICATION RESULT ==========`);
      functions.logger.info(`[NOTIFICATION_RESULT] Total tokens: ${tokens.length}`);
      functions.logger.info(`[NOTIFICATION_RESULT] Successfully sent: ${successCount}`);
      functions.logger.info(`[NOTIFICATION_RESULT] Failed: ${failureCount}`);
      
      if (successCount === 0 && failureCount === 0) {
        functions.logger.error(`[NOTIFICATION_RESULT] ❌ No notifications were sent!`);
        functions.logger.error(`[NOTIFICATION_RESULT] This usually means Expo API rejected all tokens`);
        functions.logger.error(`[NOTIFICATION_RESULT] Check for PUSH_TOO_MANY_EXPERIENCE_IDS error above`);
      } else if (successCount === 0) {
        functions.logger.error(`[NOTIFICATION_RESULT] ❌ All ${failureCount} notifications failed!`);
      } else {
        functions.logger.info(`[NOTIFICATION_RESULT] ✅ Successfully sent to ${successCount} users`);
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
      functions.logger.error("Error sending promotional notification:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to send notification",
        error instanceof Error ? error.message : String(error)
      );
    }
  }
);

