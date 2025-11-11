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
      const messaging = admin.messaging();

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

      // Fetch FCM tokens for all target users from the global users collection
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
          
          // Check for pushTokens array (new structure)
          if (userData.pushTokens && Array.isArray(userData.pushTokens)) {
            userData.pushTokens.forEach((tokenObj: any) => {
              // Only add active tokens
              if (tokenObj.active && tokenObj.token) {
                tokens.push(tokenObj.token);
              }
            });
          }
          // Fallback to old single token fields
          else if (userData.fcmToken) {
            tokens.push(userData.fcmToken);
          } else if (userData.pushToken) {
            tokens.push(userData.pushToken);
          } else if (userData.deviceToken) {
            tokens.push(userData.deviceToken);
          }
        });
      }

      if (tokens.length === 0) {
        functions.logger.warn("No FCM tokens found for target users");
        return {
          success: true,
          sentTo: 0,
          message: "No users have push notifications enabled"
        };
      }

      functions.logger.info(`Found ${tokens.length} FCM tokens`);

      // Prepare notification payload
      const message: admin.messaging.MulticastMessage = {
        notification: {
          title: data.title,
          body: data.body,
        },
        data: {
          type: "promotional",
          timestamp: new Date().toISOString(),
        },
        tokens: tokens,
        android: {
          priority: "high",
          notification: {
            sound: "default",
            clickAction: "FLUTTER_NOTIFICATION_CLICK",
          },
        },
        apns: {
          payload: {
            aps: {
              sound: "default",
              badge: 1,
            },
          },
        },
      };

      // Send the notification
      const response = await messaging.sendEachForMulticast(message);

      functions.logger.info(
        `Notification sent. Success: ${response.successCount}, Failed: ${response.failureCount}`
      );

      // Log failed tokens for debugging
      if (response.failureCount > 0) {
        const failedTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(tokens[idx]);
            functions.logger.error(`Failed to send to token ${tokens[idx]}: ${resp.error?.message}`);
          }
        });
      }

      return {
        success: true,
        sentTo: response.successCount,
        failed: response.failureCount,
        message: `Notification sent successfully to ${response.successCount} users`
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

