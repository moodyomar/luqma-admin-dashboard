import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

interface UpdateDriverProfileRequest {
  businessId: string;
  name: string;
}

interface UpdateDriverProfileResponse {
  success: boolean;
  message: string;
}

/**
 * Callable function for drivers to update their own profile (name)
 * Updates both Firestore membership document and Firebase Auth displayName
 */
export const updateDriverProfile = functions.https.onCall(
  async (data: UpdateDriverProfileRequest, context): Promise<UpdateDriverProfileResponse> => {
    // ========================================
    // 1. AUTHENTICATION & AUTHORIZATION
    // ========================================
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "المستخدم غير مصادق عليه"
      );
    }

    const callerUid = context.auth.uid;
    const callerClaims = context.auth.token;

    // Check if caller is a driver
    if (!callerClaims.roles || !callerClaims.roles.includes("driver")) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "فقط السائقون يمكنهم تحديث ملفهم الشخصي"
      );
    }

    // Check if caller has access to this business
    if (
      !callerClaims.businessIds ||
      !callerClaims.businessIds.includes(data.businessId)
    ) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "ليس لديك صلاحية للوصول إلى هذا العمل"
      );
    }

    // ========================================
    // 2. VALIDATE INPUT
    // ========================================
    if (!data.businessId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "معرف العمل مطلوب"
      );
    }

    if (!data.name || !data.name.trim()) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "الاسم مطلوب"
      );
    }

    const trimmedName = data.name.trim();

    if (trimmedName.length < 2) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "الاسم يجب أن يكون على الأقل حرفين"
      );
    }

    if (trimmedName.length > 50) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "الاسم طويل جداً (الحد الأقصى 50 حرف)"
      );
    }

    try {
      // ========================================
      // 3. UPDATE FIRESTORE MEMBERSHIP DOCUMENT
      // ========================================
      const membershipRef = admin
        .firestore()
        .doc(`menus/${data.businessId}/users/${callerUid}`);

      // Verify the document exists
      const membershipDoc = await membershipRef.get();
      if (!membershipDoc.exists) {
        throw new functions.https.HttpsError(
          "not-found",
          "لم يتم العثور على ملف المستخدم"
        );
      }

      // Update the membership document
      await membershipRef.update({
        name: trimmedName,
        displayName: trimmedName,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`✅ Updated Firestore membership doc for driver ${callerUid} in business ${data.businessId}`);

      // ========================================
      // 4. UPDATE FIREBASE AUTH DISPLAYNAME
      // ========================================
      try {
        await admin.auth().updateUser(callerUid, {
          displayName: trimmedName,
        });
        console.log(`✅ Updated Firebase Auth displayName for driver ${callerUid}`);
      } catch (authError: any) {
        // Log but don't fail the entire operation if Auth update fails
        console.error(`⚠️ Failed to update Auth displayName for ${callerUid}:`, authError);
        // Continue - Firestore update succeeded
      }

      return {
        success: true,
        message: "تم تحديث الاسم بنجاح",
      };
    } catch (error: any) {
      console.error("❌ updateDriverProfile error:", error);
      
      // If it's already an HttpsError, re-throw it
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      // Otherwise, wrap it in an HttpsError
      throw new functions.https.HttpsError(
        "internal",
        error?.message || "فشل تحديث الاسم. يرجى المحاولة مرة أخرى."
      );
    }
  }
);



