import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { addBusinessClaims } from "./setClaims";

interface InviteUserRequest {
  businessId: string;
  email?: string;
  phone?: string;
  role: "admin" | "driver";
  displayName?: string;
  // Optional password for email users; if omitted, a strong random password is generated
  password?: string;
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
    let existingUser: admin.auth.UserRecord | null = null;
    let existingMembershipDoc: admin.firestore.DocumentSnapshot | null = null;
    let existingMembershipUid: string | null = null;

    try {
      // First, check if there's an existing membership document with this email
      // This handles the case where a driver was created but Auth user doesn't exist or was deleted
      if (data.email) {
        const usersRef = admin.firestore().collection(`menus/${data.businessId}/users`);
        const emailQuery = await usersRef.where('email', '==', data.email.trim()).where('role', '==', data.role).limit(1).get();
        if (!emailQuery.empty) {
          existingMembershipDoc = emailQuery.docs[0];
          existingMembershipUid = existingMembershipDoc.id;
          console.log(`🔍 Found existing membership document with email ${data.email}, uid: ${existingMembershipUid}`);
        }
      }

      // Try to find existing Auth user
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

      // If we found an existing membership doc but no Auth user, try to get Auth user by the membership doc's UID
      if (!existingUser && existingMembershipUid) {
        try {
          existingUser = await admin.auth().getUser(existingMembershipUid);
          console.log(`✅ Found Auth user using existing membership doc UID: ${existingMembershipUid}`);
        } catch (error: any) {
          if (error.code !== "auth/user-not-found") {
            throw error;
          }
          // Auth user doesn't exist for this UID, but membership doc does - we'll create Auth user with this UID
          console.log(`⚠️ Membership doc exists but Auth user doesn't. Will create Auth user with existing UID: ${existingMembershipUid}`);
        }
      }

      if (existingUser) {
        // User exists - use their UID (this might differ from existingMembershipUid if email was reused)
        uid = existingUser.uid;
        userEmail = existingUser.email || data.email;
        userPhone = existingUser.phoneNumber || data.phone;
        console.log(`✅ Found existing user: ${uid}`);
        
        // Update displayName in Firebase Auth if provided
        if (data.displayName && data.displayName.trim()) {
          await admin.auth().updateUser(uid, {
            displayName: data.displayName.trim()
          });
          console.log(`✅ Updated displayName for existing user: ${uid}`);
        }
      } else {
        // Create new user - use existing membership UID if available to avoid duplicate documents
        const createRequest: admin.auth.CreateRequest = {
          displayName: data.displayName?.trim() || data.email || data.phone,
          uid: existingMembershipUid || undefined, // Use existing UID if membership doc exists
        };

        if (data.email) {
          createRequest.email = data.email;
          // Use provided password when available; otherwise generate a strong random one
          createRequest.password = data.password && data.password.length >= 6
            ? data.password
            : Math.random().toString(36).slice(-12) + "!A1";
        }

        if (data.phone && data.phone.trim()) {
          createRequest.phoneNumber = data.phone.trim();
        }

        const newUser = await admin.auth().createUser(createRequest);
        uid = newUser.uid;
        isNewUser = !existingMembershipUid; // Not "new" if we're linking to existing membership doc
        console.log(`✅ Created new user: ${uid}${existingMembershipUid ? ' (linked to existing membership doc)' : ''}`);
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
      console.log(`🔍 [inviteUser] Processing membership doc for uid=${uid}, displayName="${data.displayName || 'NOT PROVIDED'}", existingUser=${!!existingUser}`);
      // Get existing membership doc to preserve name if displayName not provided
      const membershipRef = admin.firestore().doc(`menus/${data.businessId}/users/${uid}`);
      const existingDoc = await membershipRef.get();
      const existingData = existingDoc.exists ? existingDoc.data() : null;
      console.log(`🔍 [inviteUser] Existing doc exists: ${existingDoc.exists}, existing name: "${existingData?.name || 'null'}"`);
      
      // Determine the name to use:
      // 1. If displayName is provided, use it (always update)
      // 2. If not provided but existing doc has name, preserve it
      // 3. If not provided and no existing doc, try to get from Auth user (existingUser or fetch)
      // 4. Otherwise, use null
      let driverName: string | null = null;
      if (data.displayName?.trim()) {
        driverName = data.displayName.trim();
      } else if (existingData?.name) {
        driverName = existingData.name; // Preserve existing name
      } else {
        // Try to get from Auth user as fallback
        let authDisplayName: string | undefined = undefined;
        if (existingUser?.displayName) {
          authDisplayName = existingUser.displayName;
        } else {
          // Fetch if we don't have it (for newly created users)
          try {
            const authUser = await admin.auth().getUser(uid);
            authDisplayName = authUser.displayName || undefined;
          } catch (error) {
            // If we can't get auth user, leave as null
          }
        }
        if (authDisplayName) {
          driverName = authDisplayName;
        }
      }
      
      const membershipData: any = {
        uid,
        businessId: data.businessId,
        role: data.role,
        email: userEmail || null,
        phone: userPhone || null,
        status: "active",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // Set name fields:
      // CRITICAL: Always explicitly set name when displayName is provided, even for existing docs with null
      if (data.displayName?.trim()) {
        // Always update name when displayName is explicitly provided (for both new and existing)
        const trimmedName = data.displayName.trim();
        membershipData.name = trimmedName;
        membershipData.displayName = trimmedName;
        console.log(`✅ Setting name field to: "${trimmedName}" for ${existingDoc.exists ? 'existing' : 'new'} document`);
      } else if (driverName) {
        // Use driverName if available (from existing doc or Auth user)
        membershipData.name = driverName;
        membershipData.displayName = driverName;
        console.log(`✅ Using driverName from existing data: "${driverName}"`);
      } else if (!existingDoc.exists) {
        // Only set to null if this is a completely new document and no name provided
        membershipData.name = null;
        membershipData.displayName = null;
        console.log(`⚠️ Creating new document without name`);
      } else {
        // Existing doc exists and no name provided - preserve existing (don't set name fields)
        console.log(`ℹ️ Preserving existing name (if any) for existing document`);
      }

      // Set timestamp fields only for new documents
      if (!existingDoc.exists) {
        membershipData.invitedBy = callerUid;
        membershipData.invitedAt = admin.firestore.FieldValue.serverTimestamp();
        membershipData.createdAt = admin.firestore.FieldValue.serverTimestamp();
      }

      // Use update() for existing docs to ensure all fields are updated, set() for new docs
      if (existingDoc.exists) {
        // For existing documents, use update() to ensure fields are overwritten (including null -> value)
        await membershipRef.update(membershipData);
        console.log(`✅ Updated existing membership document for ${uid} in ${data.businessId}`);
      } else {
        // For new documents, use set() with merge (though merge isn't needed for new docs)
        await membershipRef.set(membershipData);
        console.log(`✅ Created new membership document for ${uid} in ${data.businessId}`);
      }
      
      // Verify the update worked by reading it back
      const verifyDoc = await membershipRef.get();
      const verifyData = verifyDoc.data();
      console.log(`📋 Document data after save - name: "${verifyData?.name || 'null'}", displayName: "${verifyData?.displayName || 'null'}"`);
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






