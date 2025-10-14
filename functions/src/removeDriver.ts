import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { removeBusinessClaims, forceTokenRefresh } from "./setClaims";

interface RemoveDriverRequest {
  businessId: string;
  uid: string;
  deleteAuthUser?: boolean;
}

export const removeDriver = functions.https.onCall(
  async (data: RemoveDriverRequest, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "المستخدم غير مصادق عليه"
      );
    }

    const claims: any = context.auth.token;

    if (!claims.roles || !claims.roles.includes("admin")) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "فقط المسؤولون يمكنهم حذف السائقين"
      );
    }

    if (!claims.businessIds || !claims.businessIds.includes(data.businessId)) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "ليس لديك صلاحية لإدارة هذا العمل"
      );
    }

    if (!data.uid || !data.businessId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "المعرفات غير صحيحة"
      );
    }

    try {
      // Remove Firestore membership document
      await admin
        .firestore()
        .doc(`menus/${data.businessId}/users/${data.uid}`)
        .delete();

      // Remove business claim
      await removeBusinessClaims(data.uid, data.businessId);
      await forceTokenRefresh(data.uid);

      // Optionally delete Auth user
      if (data.deleteAuthUser) {
        try {
          await admin.auth().deleteUser(data.uid);
          console.log(`✅ Auth user deleted: ${data.uid}`);
        } catch (e: any) {
          if (e.code === 'auth/user-not-found') {
            console.log(`ℹ️ Auth user already deleted: ${data.uid}`);
          } else {
            console.error(`❌ Error deleting auth user: ${e.message}`);
            // Don't throw - we still succeeded with Firestore and claims
          }
        }
      }

      return { success: true, message: "تم حذف السائق" };
    } catch (error: any) {
      console.error("❌ removeDriver error", error);
      throw new functions.https.HttpsError(
        "internal",
        error?.message || "خطأ داخلي"
      );
    }
  }
);


