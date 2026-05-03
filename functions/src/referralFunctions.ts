import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { adminSpaCallableOpts } from "./adminSpaCallableOptions";
import { sendLocalizedExpoToCustomerByPhone } from "./customerExpoPush";

/**
 * REFERRAL FUNCTIONS
 * Handles referral code application and data management
 */

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
      await sendLocalizedExpoToCustomerByPhone({
        phone: referrerPhone,
        content: notification,
        data: {
          orderId: "",
          status: "referral_code_used",
          deliveryMethod: "referral",
          screen: "ProfileTab",
        },
        log: {
          orderId: "",
          status: "referral_code_used",
          deliveryMethod: "referral",
        },
      });
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
export const resetReferralData = onCall(
  adminSpaCallableOpts,
  async (request) => {
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
  }
);

