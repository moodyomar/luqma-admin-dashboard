import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import type { CallableRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { adminSpaCallableOpts } from "./adminSpaCallableOptions";

/**
 * Admin promotional push (Expo). One handler, two exported callables:
 * - **sendAdminPromotionalPush** — canonical; use in new admin builds.
 * - **sendPromotionalNotification** — same logic + CORS; many production bundles still call this URL.
 *   Keeps white-label working without forcing an immediate frontend redeploy. Remove this export once
 *   all clients ship a build that uses sendAdminPromotionalPush only.
 */
async function promotionalPushHandler(request: CallableRequest) {
  const payload = request.data as {
    title: string;
    body: string;
    targetUsers: "all" | string[];
    businessId?: string;
  };

  // Authentication check
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must be authenticated to send notifications"
    );
  }

  // Authorization check - ensure user has admin role
  const userRoles = (request.auth.token as { roles?: string[] })?.roles || [];
  if (!userRoles.includes("admin")) {
    throw new HttpsError(
      "permission-denied",
      "Only admins can send promotional notifications"
    );
  }

  // Validate input
  if (!payload.title || !payload.body) {
    throw new HttpsError(
      "invalid-argument",
      "Title and body are required"
    );
  }

  if (payload.title.length > 65) {
    throw new HttpsError(
      "invalid-argument",
      "Title must be 65 characters or less"
    );
  }

  if (payload.body.length > 240) {
    throw new HttpsError(
      "invalid-argument",
      "Body must be 240 characters or less"
    );
  }

    try {
      const db = admin.firestore();
      const fetch = require("node-fetch");
      const isExpoPushToken = (token: unknown): token is string => {
        if (typeof token !== "string") return false;
        return token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[");
      };

      // Fetch Expo push tokens for all target users from the global users collection
      const tokens: string[] = [];
      let userDocs: admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>[] = [];

      // Determine target users
      if (payload.targetUsers === "all") {
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
              tokenObj &&
              typeof tokenObj === "object" &&
              tokenObj.active &&
              tokenObj.appType === "driver"
            );
            if (hasDriverTokens) {
              return false; // Exclude drivers
            }
          }
          
          return true; // Include customer users
        });
        
        logger.info(`Sending notification to all customer users: ${userDocs.length} users (filtered out drivers and users without phone numbers)`);
      } else if (Array.isArray(payload.targetUsers)) {
        const userIds = payload.targetUsers;
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
            // Accept both ExponentPushToken[...] and ExpoPushToken[...]
            // and support both object and string token entries.
            const tokenValue =
              typeof tokenObj === "string" ? tokenObj : tokenObj?.token;
            const isActive =
              typeof tokenObj === "string" ? true : tokenObj?.active !== false;

            if (isActive && isExpoPushToken(tokenValue)) {
              // CRITICAL: Only include customer app tokens
              // Include if appType is undefined/null OR appType is 'customer'
              // Exclude if appType is 'driver' or any other value
              const appType = typeof tokenObj === "string" ? null : tokenObj?.appType;
              if (!appType || appType === "customer") {
                customerAppTokens.push(tokenValue);
                userCustomerTokenCount++;
              } else if (appType === "driver") {
                // This is a driver token - exclude it
                driverAppTokens.push(tokenValue);
                userDriverTokenCount++;
              } else {
                // Unknown appType - exclude it to be safe
                logger.warn(`[USER ${userId}] Excluding token with unknown appType: ${appType}`);
              }
            }
          });
        }
        // Fallback to old single token fields (Expo tokens) - assume customer app (backward compatibility)
        else if (isExpoPushToken(userData.pushToken)) {
          customerAppTokens.push(userData.pushToken);
          userCustomerTokenCount++;
        } else if (isExpoPushToken(userData.fcmToken)) {
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
        title: payload.title,
        body: payload.body,
        data: {
          type: "promotional",
          timestamp: new Date().toISOString(),
        },
        channelId: "default",
      }));

      // Same Expo Push API path as all other clients (Safaa, Refresh, Luqma): no auth by default.
      // If someone opts into Expo "Enhanced security for push" on a specific account, set EXPO_ACCESS_TOKEN
      // on this function only for that rare case — not part of the standard white-label template.
      const expoHeaders: Record<string, string> = {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      };
      const expoAccess = process.env.EXPO_ACCESS_TOKEN?.trim();
      if (expoAccess) {
        expoHeaders.Authorization = `Bearer ${expoAccess}`;
      }

      const expoErrorSummary: string[] = [];
      const pushExpoError = (msg: string) => {
        const s = (msg || "Unknown Expo error").slice(0, 220);
        if (s && expoErrorSummary.length < 10 && !expoErrorSummary.includes(s)) {
          expoErrorSummary.push(s);
        }
      };

      type ExpoMsg = (typeof customerMessages)[number];

      const postExpo = async (messages: ExpoMsg[]) => {
        const response = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: expoHeaders,
          body: JSON.stringify(messages),
        });
        let result: any = null;
        try {
          result = await response.json();
        } catch {
          result = null;
        }
        return { response, result };
      };

      const sendOneExpo = async (msg: ExpoMsg): Promise<"ok" | "fail"> => {
        const { response, result } = await postExpo([msg]);
        if (!response.ok) {
          const top =
            result?.errors?.[0] &&
            `${(result.errors[0] as { code?: string }).code}: ${(result.errors[0] as { message?: string }).message}`;
          pushExpoError(top || `HTTP ${response.status} ${response.statusText}`);
          logger.error(`Expo single push HTTP error: ${response.status}`, JSON.stringify(result, null, 2));
          return "fail";
        }
        const item = result?.data?.[0];
        if (item?.status === "ok") return "ok";
        const detail =
          item?.message ||
          (item?.details ? JSON.stringify(item.details) : null) ||
          JSON.stringify(item);
        pushExpoError(String(detail));
        logger.error(`Expo ticket not ok: ${detail}`);
        return "fail";
      };

      let successCount = 0;
      let failureCount = 0;

      const retryChunkOneByOne = async (chunk: ExpoMsg[], reason: string) => {
        logger.warn(`[FALLBACK] ${reason}; retrying ${chunk.length} message(s) token-by-token`);
        for (const msg of chunk) {
          const r = await sendOneExpo(msg);
          if (r === "ok") successCount++;
          else failureCount++;
        }
      };

      const chunks: ExpoMsg[][] = [];
      for (let i = 0; i < customerMessages.length; i += 100) {
        chunks.push(customerMessages.slice(i, i + 100));
      }

      logger.info(`Sending ${customerMessages.length} customer app messages in ${chunks.length} chunk(s)`);
      if (expoAccess) {
        logger.info("EXPO_ACCESS_TOKEN is set (optional Expo enhanced-security mode).");
      }

      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];
        try {
          logger.info(`Sending chunk ${chunkIndex + 1}/${chunks.length} with ${chunk.length} messages`);
          const { response, result } = await postExpo(chunk);

          if (!response.ok) {
            logger.error(`Expo API error: ${response.status} ${response.statusText}`, JSON.stringify(result, null, 2));
            const hasMixedExperienceIds =
              result &&
              Array.isArray(result.errors) &&
              result.errors.some((e: { code?: string }) => e?.code === "PUSH_TOO_MANY_EXPERIENCE_IDS");
            await retryChunkOneByOne(
              chunk,
              hasMixedExperienceIds ? "PUSH_TOO_MANY_EXPERIENCE_IDS" : "non-OK HTTP from Expo"
            );
            continue;
          }

          if (result?.errors?.length) {
            result.errors.forEach((error: { code?: string; message?: string; details?: unknown }) => {
              logger.error(`Expo API error: ${error.code} - ${error.message}`, error.details);
            });
          }

          if (!Array.isArray(result?.data) || result.data.length !== chunk.length) {
            logger.error("Expo response missing data[] or length mismatch; retrying chunk per token");
            await retryChunkOneByOne(chunk, "invalid Expo data[]");
            continue;
          }

          for (let i = 0; i < chunk.length; i++) {
            const item = result.data[i];
            if (item?.status === "ok") {
              successCount++;
              continue;
            }
            logger.warn(`Batch ticket ${i} not ok (${item?.message || "error"}); retrying single`);
            const r = await sendOneExpo(chunk[i]);
            if (r === "ok") successCount++;
            else failureCount++;
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
        if (expoErrorSummary.length) {
          logger.error(`[NOTIFICATION_RESULT] Expo errors (sample): ${JSON.stringify(expoErrorSummary)}`);
        }
      } else {
        logger.info(`[NOTIFICATION_RESULT] ✅ Successfully sent to ${successCount} users`);
      }

      return {
        success: true,
        sentTo: successCount,
        failed: failureCount,
        totalTokens: tokens.length,
        message: `Notification sent successfully to ${successCount} users`,
        expoErrorSummary: expoErrorSummary.length > 0 ? expoErrorSummary : undefined,
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

export const sendAdminPromotionalPush = onCall(
  adminSpaCallableOpts,
  promotionalPushHandler
);

export const sendPromotionalNotification = onCall(
  adminSpaCallableOpts,
  promotionalPushHandler
);

