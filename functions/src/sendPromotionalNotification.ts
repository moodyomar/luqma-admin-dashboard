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

      let userIds: string[] = [];

      // Determine target users
      if (data.targetUsers === "all") {
        // Get all users from the global users collection (where push tokens are stored)
        const usersSnapshot = await db
          .collection("users")
          .get();

        userIds = usersSnapshot.docs.map((doc) => doc.id);
        
        functions.logger.info(`Sending notification to all users: ${userIds.length} users`);
      } else if (Array.isArray(data.targetUsers)) {
        userIds = data.targetUsers;
        functions.logger.info(`Sending notification to specific users: ${userIds.length} users`);
      } else {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "targetUsers must be 'all' or an array of user IDs"
        );
      }

      if (userIds.length === 0) {
        return {
          success: true,
          sentTo: 0,
          message: "No users to send notifications to"
        };
      }

      // Fetch Expo push tokens for all target users from the global users collection
      const tokens: string[] = [];
      const batchSize = 10; // Firestore 'in' query limit

      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        const userDocs = await db
          .collection("users")
          .where(admin.firestore.FieldPath.documentId(), "in", batch)
          .get();

        userDocs.forEach((doc) => {
          const userData = doc.data();
          
          // Check for pushTokens array (new structure - Expo push tokens)
          if (userData.pushTokens && Array.isArray(userData.pushTokens)) {
            userData.pushTokens.forEach((tokenObj: any) => {
              // Only add active tokens (Expo push tokens start with "ExponentPushToken")
              if (tokenObj.active && tokenObj.token && tokenObj.token.startsWith("ExponentPushToken")) {
                tokens.push(tokenObj.token);
              }
            });
          }
          // Fallback to old single token fields (Expo tokens)
          else if (userData.pushToken && userData.pushToken.startsWith("ExponentPushToken")) {
            tokens.push(userData.pushToken);
          } else if (userData.fcmToken && userData.fcmToken.startsWith("ExponentPushToken")) {
            tokens.push(userData.fcmToken);
          }
        });
      }

      if (tokens.length === 0) {
        functions.logger.warn("No Expo push tokens found for target users");
        return {
          success: true,
          sentTo: 0,
          message: "No users have push notifications enabled"
        };
      }

      functions.logger.info(`Found ${tokens.length} Expo push tokens`);

      // Prepare Expo push notification messages
      const messages = tokens.map((token: string) => ({
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

      // Send via Expo Push API (same as customerNotifications.ts)
      let successCount = 0;
      let failureCount = 0;

      // Expo limits to 100 notifications per request
      const chunks = [];
      for (let i = 0; i < messages.length; i += 100) {
        chunks.push(messages.slice(i, i + 100));
      }

      for (const chunk of chunks) {
        try {
          const response = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Accept-Encoding": "gzip, deflate",
              "Content-Type": "application/json",
            },
            body: JSON.stringify(chunk),
          });

          const result = await response.json();
          functions.logger.info("Expo push response:", JSON.stringify(result, null, 2));

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
          }
        } catch (error) {
          functions.logger.error("Error sending chunk to Expo:", error);
          failureCount += chunk.length;
        }
      }

      functions.logger.info(
        `Notification sent. Success: ${successCount}, Failed: ${failureCount}`
      );

      return {
        success: true,
        sentTo: successCount,
        failed: failureCount,
        message: `Notification sent successfully to ${successCount} users`
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

