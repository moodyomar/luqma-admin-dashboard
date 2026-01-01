import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

interface ResetPasswordRequest {
  businessId: string;
  driverId: string; // User UID
  newPassword?: string; // Optional: if not provided, generates a random password
}

interface ResetPasswordResponse {
  success: boolean;
  message: string;
  newPassword?: string; // Only returned if password was auto-generated
}

/**
 * Reset or set password for a driver
 * Admin-only function
 */
export const resetDriverPassword = functions.https.onCall(
  async (data: ResetPasswordRequest, context): Promise<ResetPasswordResponse> => {
    // ========================================
    // 1. AUTHENTICATION & AUTHORIZATION
    // ========================================
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "المستخدم غير مصادق عليه"
      );
    }

    const callerClaims = context.auth.token;

    // Check if caller is admin
    if (!callerClaims.roles || !callerClaims.roles.includes("admin")) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "فقط المسؤولون يمكنهم إعادة تعيين كلمات المرور"
      );
    }

    // Check if caller has access to this business
    if (
      !callerClaims.businessIds ||
      !callerClaims.businessIds.includes(data.businessId)
    ) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "ليس لديك صلاحية لإدارة هذا العمل"
      );
    }

    // ========================================
    // 2. VALIDATE INPUT
    // ========================================
    if (!data.businessId || !data.driverId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "معرف العمل ومعرف السائق مطلوبان"
      );
    }

    // ========================================
    // 3. VERIFY DRIVER EXISTS AND BELONGS TO BUSINESS
    // ========================================
    try {
      const membershipRef = admin
        .firestore()
        .doc(`menus/${data.businessId}/users/${data.driverId}`);
      const membershipDoc = await membershipRef.get();

      if (!membershipDoc.exists) {
        throw new functions.https.HttpsError(
          "not-found",
          "السائق غير موجود"
        );
      }

      const membershipData = membershipDoc.data();
      if (membershipData?.role !== "driver") {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "المستخدم المحدد ليس سائقاً"
        );
      }

      // ========================================
      // 4. GENERATE OR USE PROVIDED PASSWORD
      // ========================================
      let newPassword: string;
      if (data.newPassword && data.newPassword.length >= 6) {
        newPassword = data.newPassword;
      } else {
        // Generate a strong random password
        const randomPart = Math.random().toString(36).slice(-10);
        const numberPart = Math.floor(Math.random() * 10000);
        newPassword = `${randomPart}${numberPart}!A1`;
      }

      // ========================================
      // 5. UPDATE PASSWORD IN FIREBASE AUTH
      // ========================================
      try {
        await admin.auth().updateUser(data.driverId, {
          password: newPassword,
        });
        console.log(`✅ Password reset for driver ${data.driverId} in business ${data.businessId}`);

        // Return response
        // If password was auto-generated, return it so admin can share it with driver
        // If password was provided, don't return it (security)
        if (!data.newPassword) {
          return {
            success: true,
            message: "تم إعادة تعيين كلمة المرور بنجاح",
            newPassword: newPassword, // Return generated password
          };
        } else {
          return {
            success: true,
            message: "تم تعيين كلمة المرور بنجاح",
          };
        }
      } catch (authError: any) {
        console.error(`❌ Error updating password for driver ${data.driverId}:`, authError);
        
        // Handle specific auth errors
        if (authError.code === "auth/user-not-found") {
          throw new functions.https.HttpsError(
            "not-found",
            "حساب السائق غير موجود في نظام المصادقة"
          );
        } else if (authError.code === "auth/invalid-password") {
          throw new functions.https.HttpsError(
            "invalid-argument",
            "كلمة المرور غير صالحة (يجب أن تكون 6 أحرف على الأقل)"
          );
        } else {
          throw new functions.https.HttpsError(
            "internal",
            `خطأ في تحديث كلمة المرور: ${authError.message}`
          );
        }
      }
    } catch (error: any) {
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      console.error("❌ Error resetting driver password:", error);
      throw new functions.https.HttpsError(
        "internal",
        `خطأ في إعادة تعيين كلمة المرور: ${error.message}`
      );
    }
  }
);




