import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";

/**
 * REFERRAL FUNCTIONS
 * Handles referral code application and data management
 */

// ==========================================
// HELPER: SEND NOTIFICATION TO USER
// ==========================================
async function sendNotificationToUser(
  phone: string,
  content: { ar: { title: string; body: string }; he: { title: string; body: string } },
  orderId: string,
  status: string,
  deliveryMethod: string
) {
  // Find user by phone
  const usersSnapshot = await admin
    .firestore()
    .collection("users")
    .where("phone", "==", phone)
    .limit(1)
    .get();

  if (usersSnapshot.empty) {
    logger.warn(`No user found for phone: ${phone}`);
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
    logger.info(`No active Expo push tokens for user ${userId} (phone: ${phone})`);
    return;
  }

  logger.info(`Found ${tokens.length} active push token(s) for user ${userId}`);

  // Get user's preferred language (default to Arabic)
  const language = userData.language || "ar";
  const localizedContent = content[language as keyof typeof content] || content.ar;

  // Prepare push notification messages
  const messages = tokens.map((token: string) => ({
    to: token,
    sound: "default",
    title: localizedContent.title,
    body: localizedContent.body,
    data: {
      orderId: orderId || "",
      status,
      screen: orderId ? "MyOrdersScreen" : "ProfileTab",
    },
    channelId: "default",
  }));

  // Send push notifications via Expo Push API
  await sendPushNotifications(messages);

  // Log notification sent
  await admin.firestore().collection("notificationLogs").add({
    userId,
    orderId: orderId || "",
    status,
    deliveryMethod,
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    tokensCount: tokens.length,
  });

  logger.info(`Sent ${messages.length} notifications for ${orderId ? `order ${orderId}` : "referral event"}`);
}

// ==========================================
// HELPER: SEND PUSH NOTIFICATIONS VIA EXPO
// ==========================================
async function sendPushNotifications(messages: any[]) {
  if (messages.length === 0) {
    logger.info("No messages to send");
    return;
  }

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

      const data = await response.json();
      logger.info("Expo push response:", JSON.stringify(data, null, 2));

      // Check for errors in response
      if (data.data) {
        const errors = data.data.filter((item: any) => item.status === "error");
        if (errors.length > 0) {
          logger.error("Some notifications failed:", errors);
        }
      }
    } catch (error: any) {
      logger.error("Error sending push notifications:", error);
      // Continue with next chunk even if one fails
    }
  }
}

// ==========================================
// 1. ON REFERRAL CODE APPLIED
// Triggered when a user applies a referral code
// Updates referrer's referral count and sends notification
// ==========================================
export const onReferralCodeApplied = onDocumentUpdated(
  "users/{userId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (!before || !after) {
      logger.warn("Missing before/after data in referral code event");
      return;
    }

    // Log for debugging
    logger.info(
      `[ReferralCodeApplied] User ${event.params.userId} - before.referredBy: ${before.referredBy}, after.referredBy: ${after.referredBy}`
    );

    // Only trigger if referredBy was just added (was null/undefined/empty, now has value)
    const hadReferralBefore = before.referredBy && before.referredBy.trim() !== "";
    const hasReferralAfter = after.referredBy && after.referredBy.trim() !== "";

    if (hadReferralBefore || !hasReferralAfter) {
      logger.info(
        `[ReferralCodeApplied] Skipping - hadReferralBefore: ${hadReferralBefore}, hasReferralAfter: ${hasReferralAfter}`
      );
      return; // Not a new referral application
    }

    // Check if referredByUserId exists
    if (!after.referredByUserId) {
      logger.info(
        `[ReferralCodeApplied] No referredByUserId found for user ${event.params.userId}, skipping notification`
      );
      return;
    }

    logger.info(
      `[ReferralCodeApplied] ✅ User ${event.params.userId} applied referral code: ${after.referredBy}, referrerId: ${after.referredByUserId}`
    );

    // Get referrer's phone number
    const referrerRef = admin.firestore().collection("users").doc(after.referredByUserId);
    const referrerDoc = await referrerRef.get();

    if (!referrerDoc.exists) {
      logger.warn(`[ReferralCodeApplied] ❌ Referrer not found: ${after.referredByUserId}`);
      return;
    }

    const referrerData = referrerDoc.data();
    const referrerPhone = referrerData?.phone;

    if (!referrerPhone) {
      logger.warn(`[ReferralCodeApplied] ❌ Referrer has no phone number: ${after.referredByUserId}`);
      return;
    }

    // Update referrer's referral count (increment if not already updated by client)
    try {
      const currentCount = referrerData?.referralCount || 0;
      // Check if this user was already counted (to avoid double counting)
      // We'll increment it here to ensure it's always updated
      await referrerRef.update({
        referralCount: admin.firestore.FieldValue.increment(1),
        lastReferralAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      logger.info(
        `✅ [ReferralCodeApplied] Updated referral count for referrer ${after.referredByUserId} from ${currentCount} to ${currentCount + 1}`
      );
    } catch (updateError: any) {
      logger.error(`❌ [ReferralCodeApplied] Error updating referral count:`, updateError);
      // Continue anyway - notification is more important
    }

    // Notification to referrer when someone uses their code
    const notification = {
      ar: {
        title: "🎉 شخص جديد استخدم كودك!",
        body: "استخدم شخص ما كود الشراكه الخاص بك! ستحصل على مكافأة عند إكمال طلبهم الأول 🎁",
      },
      he: {
        title: "🎉 מישהו חדש השתמש בקוד שלך!",
        body: "מישהו השתמש בקוד השותפות שלך! תקבל פרס כשהם ישלימו את ההזמנה הראשונה שלהם 🎁",
      },
    };

    // Send notification to referrer
    try {
      await sendNotificationToUser(referrerPhone, notification, "", "referral_code_used", "referral");
      logger.info(`✅ [ReferralCodeApplied] Sent notification to referrer ${referrerPhone} about code usage`);
    } catch (notifError: any) {
      logger.error(`❌ [ReferralCodeApplied] Error sending notification:`, notifError);
    }
  }
);

// ==========================================
// 2. RESET REFERRAL DATA
// Admin function to reset referral data for a user
// ==========================================
export const resetReferralData = onCall(async (request) => {
  // Check if caller is admin
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "المستخدم غير مصادق عليه");
  }

  const { userId, resetReferrer = false } = request.data;

  if (!userId) {
    throw new HttpsError("invalid-argument", "User ID is required");
  }

  try {
    const userRef = admin.firestore().collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      throw new HttpsError("not-found", "User not found");
    }

    const userData = userDoc.data();
    const updates: any = {};

    // Reset referred user fields
    updates.referredBy = admin.firestore.FieldValue.delete();
    updates.referredByUserId = admin.firestore.FieldValue.delete();
    updates.referredAt = admin.firestore.FieldValue.delete();
    updates.referralRewardAwarded = admin.firestore.FieldValue.delete();
    updates.referralRewardAmount = admin.firestore.FieldValue.delete();

    // If resetting referrer stats
    if (resetReferrer) {
      const referralRewards = userData?.referralRewards || 0;
      updates.referralCount = 0;
      updates.referralRewards = 0;
      // Optionally subtract referral rewards from points
      if (userData?.points && referralRewards > 0) {
        updates.points = admin.firestore.FieldValue.increment(-referralRewards);
      }
    }

    await userRef.update(updates);

    // Delete referral transactions
    const transactionsRef = userRef.collection("referralTransactions");
    const transactionsSnapshot = await transactionsRef.get();
    const batch = admin.firestore().batch();

    transactionsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    logger.info(`✅ Reset referral data for user ${userId}`);

    return {
      success: true,
      message: "Referral data reset successfully",
      deletedTransactions: transactionsSnapshot.size,
    };
  } catch (error: any) {
    logger.error("Error resetting referral data:", error);
    throw new HttpsError("internal", `خطأ في إعادة تعيين بيانات الإحالة: ${error.message}`);
  }
});

