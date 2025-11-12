import * as admin from "firebase-admin";

/**
 * Helper function to add business and role claims to a user
 * Merges with existing claims to support multi-business membership
 */
export async function addBusinessClaims(
  uid: string,
  businessId: string,
  roles: string[]
): Promise<void> {
  try {
    const user = await admin.auth().getUser(uid);
    const claims = (user.customClaims || {}) as any;

    // Merge businessIds (ensure uniqueness)
    const businessIds = new Set<string>(claims.businessIds || []);
    businessIds.add(businessId);

    // Merge roles (ensure uniqueness)
    const existingRoles = claims.roles || [];
    const newRoles = Array.from(new Set([...existingRoles, ...roles]));

    // Set updated claims
    await admin.auth().setCustomUserClaims(uid, {
      ...claims,
      businessIds: Array.from(businessIds),
      roles: newRoles,
    });

    console.log(`✅ Claims updated for user ${uid}:`, {
      businessIds: Array.from(businessIds),
      roles: newRoles,
    });
  } catch (error) {
    console.error(`❌ Error setting claims for user ${uid}:`, error);
    throw error;
  }
}

/**
 * Helper function to remove business access from a user
 */
export async function removeBusinessClaims(
  uid: string,
  businessId: string
): Promise<void> {
  try {
    const user = await admin.auth().getUser(uid);
    const claims = (user.customClaims || {}) as any;

    // Remove businessId
    const businessIds = new Set<string>(claims.businessIds || []);
    businessIds.delete(businessId);

    // Keep roles as-is (user might belong to other businesses)
    await admin.auth().setCustomUserClaims(uid, {
      ...claims,
      businessIds: Array.from(businessIds),
    });

    console.log(`✅ Business ${businessId} removed from user ${uid}`);
  } catch (error) {
    console.error(`❌ Error removing business claims for user ${uid}:`, error);
    throw error;
  }
}

/**
 * Force token refresh by revoking all refresh tokens
 * User will need to re-authenticate to get new claims
 */
export async function forceTokenRefresh(uid: string): Promise<void> {
  try {
    await admin.auth().revokeRefreshTokens(uid);
    console.log(`✅ Tokens revoked for user ${uid} - claims will update on next sign-in`);
  } catch (error) {
    console.error(`❌ Error revoking tokens for user ${uid}:`, error);
    throw error;
  }
}











