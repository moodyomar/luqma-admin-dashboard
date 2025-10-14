import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { addBusinessClaims } from "./setClaims";

interface InviteUserRequest {
  businessId: string;
  email?: string;
  phone?: string;
  role: "admin" | "driver";
  displayName?: string;
}

interface InviteUserResponse {
  uid: string;
  email?: string;
  phone?: string;
  isNewUser: boolean;
  message: string;
}

/**
 * Callable function to invite a user to a business
 * Creates Auth user if needed, sets custom claims, and creates membership doc
 */
export const inviteUser = functions.https.onCall(
  async (data: InviteUserRequest, context): Promise<InviteUserResponse> => {
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

    // Check if caller is admin
    if (!callerClaims.roles || !callerClaims.roles.includes("admin")) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "فقط المسؤولون يمكنهم دعوة المستخدمين"
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
    if (!data.businessId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "معرف العمل مطلوب"
      );
    }

    if (!data.email && !data.phone) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "البريد الإلكتروني أو رقم الهاتف مطلوب"
      );
    }

    if (!["admin", "driver"].includes(data.role)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "الدور يجب أن يكون admin أو driver"
      );
    }

    // ========================================
    // 3. CREATE OR GET AUTH USER
    // ========================================
    let uid: string;
    let isNewUser = false;
    let userEmail = data.email;
    let userPhone = data.phone;

    try {
      // Try to find existing user
      let existingUser: admin.auth.UserRecord | null = null;

      if (data.email) {
        try {
          existingUser = await admin.auth().getUserByEmail(data.email);
        } catch (error: any) {
          if (error.code !== "auth/user-not-found") {
            throw error;
          }
        }
      }

      if (!existingUser && data.phone) {
        try {
          existingUser = await admin.auth().getUserByPhoneNumber(data.phone);
        } catch (error: any) {
          if (error.code !== "auth/user-not-found") {
            throw error;
          }
        }
      }

      if (existingUser) {
        // User exists - use their UID
        uid = existingUser.uid;
        userEmail = existingUser.email || data.email;
        userPhone = existingUser.phoneNumber || data.phone;
        console.log(`✅ Found existing user: ${uid}`);
      } else {
        // Create new user
        const createRequest: admin.auth.CreateRequest = {
          displayName: data.displayName || data.email || data.phone,
        };

        if (data.email) {
          createRequest.email = data.email;
          // Generate random password for email users
          createRequest.password = Math.random().toString(36).slice(-12) + "!A1";
        }

        if (data.phone) {
          createRequest.phoneNumber = data.phone;
        }

        const newUser = await admin.auth().createUser(createRequest);
        uid = newUser.uid;
        isNewUser = true;
        console.log(`✅ Created new user: ${uid}`);
      }
    } catch (error: any) {
      console.error("❌ Error creating/fetching user:", error);
      throw new functions.https.HttpsError(
        "internal",
        `خطأ في إنشاء المستخدم: ${error.message}`
      );
    }

    // ========================================
    // 4. SET CUSTOM CLAIMS
    // ========================================
    try {
      await addBusinessClaims(uid, data.businessId, [data.role]);
      console.log(`✅ Claims set for user ${uid}`);
    } catch (error: any) {
      console.error("❌ Error setting claims:", error);
      throw new functions.https.HttpsError(
        "internal",
        `خطأ في تعيين الصلاحيات: ${error.message}`
      );
    }

    // ========================================
    // 5. CREATE MEMBERSHIP DOCUMENT
    // ========================================
    try {
      const membershipData = {
        uid,
        businessId: data.businessId,
        role: data.role,
        email: userEmail || null,
        phone: userPhone || null,
        displayName: data.displayName || userEmail || userPhone || "User",
        status: "active",
        invitedBy: callerUid,
        invitedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await admin
        .firestore()
        .doc(`menus/${data.businessId}/users/${uid}`)
        .set(membershipData, { merge: true });

      console.log(`✅ Membership document created for ${uid} in ${data.businessId}`);
    } catch (error: any) {
      console.error("❌ Error creating membership doc:", error);
      throw new functions.https.HttpsError(
        "internal",
        `خطأ في إنشاء وثيقة العضوية: ${error.message}`
      );
    }

    // ========================================
    // 6. RETURN SUCCESS RESPONSE
    // ========================================
    return {
      uid,
      email: userEmail,
      phone: userPhone,
      isNewUser,
      message: isNewUser
        ? "تم إنشاء المستخدم بنجاح وإضافته إلى العمل"
        : "تم إضافة المستخدم الموجود إلى العمل بنجاح",
    };
  }
);





