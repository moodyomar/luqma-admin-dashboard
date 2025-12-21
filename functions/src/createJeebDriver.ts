import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

/**
 * Cloud Function to create a Jeeb driver
 * Sets custom claims: { roles: ["jeeb_driver"] }
 * Creates driver profile in Firestore: drivers/{uid}
 */
export const createJeebDriver = functions.https.onCall(
  async (data: { email: string; password: string; name?: string; phone?: string }, context) => {
    console.log(`📥 [createJeebDriver] Received request:`, data);

    // ========================================
    // 1. AUTHENTICATION & AUTHORIZATION
    // ========================================
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "المستخدم غير مصادق عليه"
      );
    }

    // Allow any authenticated user to create Jeeb drivers
    // To restrict to admins only, uncomment:
    // const callerClaims = context.auth.token;
    // const isAdmin = callerClaims.roles && callerClaims.roles.includes("admin");
    // if (!isAdmin) {
    //   throw new functions.https.HttpsError("permission-denied", "Admin only");
    // }

    // ========================================
    // 2. VALIDATE INPUT
    // ========================================
    if (!data.email || !data.password) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "البريد الإلكتروني وكلمة المرور مطلوبان"
      );
    }

    if (data.password.length < 6) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "كلمة المرور يجب أن تكون 6 أحرف على الأقل"
      );
    }

    try {
      // ========================================
      // 3. CREATE AUTH USER
      // ========================================
      let uid: string;
      let isNewUser = false;

      try {
        // Check if user already exists
        const existingUser = await admin.auth().getUserByEmail(data.email.trim());
        uid = existingUser.uid;
        console.log(`✅ Found existing user: ${uid}`);
      } catch (error: any) {
        if (error.code !== "auth/user-not-found") {
          throw error;
        }

        // Create new user
        const createRequest: admin.auth.CreateRequest = {
          email: data.email.trim(),
          password: data.password,
          displayName: data.name?.trim() || data.email.split("@")[0],
        };

        if (data.phone) {
          createRequest.phoneNumber = data.phone.trim();
        }

        const newUser = await admin.auth().createUser(createRequest);
        uid = newUser.uid;
        isNewUser = true;
        console.log(`✅ Created new Auth user: ${uid}`);
      }

      // ========================================
      // 4. SET CUSTOM CLAIMS (jeeb_driver role)
      // ========================================
      await admin.auth().setCustomUserClaims(uid, {
        roles: ["jeeb_driver"],
        // Note: No businessIds - Jeeb drivers work across all businesses
      });
      console.log(`✅ Set custom claims for ${uid}: { roles: ["jeeb_driver"] }`);

      // ========================================
      // 5. CREATE DRIVER PROFILE IN FIRESTORE
      // ========================================
      const db = admin.firestore();
      const driverRef = db.collection("drivers").doc(uid);

      const driverProfile = {
        name: data.name?.trim() || data.email.split("@")[0],
        email: data.email.trim(),
        phone: data.phone?.trim() || "",
        allowedCities: [],
        available: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await driverRef.set(driverProfile);
      console.log(`✅ Created driver profile in Firestore: drivers/${uid}`);

      return {
        success: true,
        uid,
        email: data.email.trim(),
        isNewUser,
        message: isNewUser
          ? "تم إنشاء حساب السائق بنجاح"
          : "تم تحديث حساب السائق بنجاح",
      };
    } catch (error: any) {
      console.error("❌ Error creating Jeeb driver:", error);
      throw new functions.https.HttpsError(
        "internal",
        error.message || "خطأ في إنشاء حساب السائق"
      );
    }
  }
);

