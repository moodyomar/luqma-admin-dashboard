/**
 * Backfill script to migrate existing users to the new multi-tenant system
 * 
 * Run this script once to:
 * 1. Read all existing membership docs from menus/{businessId}/users/{uid}
 * 2. Set custom claims for each user based on their memberships
 * 
 * Usage:
 * 1. Deploy functions: firebase deploy --only functions
 * 2. Run: firebase functions:shell
 * 3. Execute: backfillClaims()
 * 
 * Or create a one-time HTTP function and call it via curl
 */

import * as admin from "firebase-admin";
import { addBusinessClaims } from "../setClaims";

interface MembershipDoc {
  uid: string;
  businessId: string;
  role: string;
}

export async function backfillClaims(): Promise<void> {
  console.log("🚀 Starting claims backfill...");

  try {
    const db = admin.firestore();
    const memberships: MembershipDoc[] = [];

    // ========================================
    // 1. COLLECT ALL MEMBERSHIPS
    // ========================================
    console.log("📋 Collecting all membership documents...");

    // Get all business documents
    const menusSnapshot = await db.collection("menus").get();

    for (const menuDoc of menusSnapshot.docs) {
      const businessId = menuDoc.id;
      console.log(`  Checking business: ${businessId}`);

      // Get all users for this business
      const usersSnapshot = await db
        .collection(`menus/${businessId}/users`)
        .get();

      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        memberships.push({
          uid: userDoc.id,
          businessId,
          role: userData.role || "driver", // default to driver if not specified
        });
      }

      console.log(`  Found ${usersSnapshot.size} users in ${businessId}`);
    }

    console.log(`\n✅ Collected ${memberships.length} total memberships`);

    // ========================================
    // 2. GROUP MEMBERSHIPS BY USER
    // ========================================
    const userMemberships = new Map<string, MembershipDoc[]>();

    for (const membership of memberships) {
      if (!userMemberships.has(membership.uid)) {
        userMemberships.set(membership.uid, []);
      }
      userMemberships.get(membership.uid)!.push(membership);
    }

    console.log(`\n📊 Found ${userMemberships.size} unique users`);

    // ========================================
    // 3. SET CLAIMS FOR EACH USER
    // ========================================
    console.log("\n🔧 Setting custom claims...\n");

    let successCount = 0;
    let errorCount = 0;

    for (const [uid, memberships] of userMemberships.entries()) {
      try {
        // Collect all businessIds and roles for this user
        const businessIds = memberships.map((m) => m.businessId);
        const roles = Array.from(
          new Set(memberships.map((m) => m.role))
        );

        // Set claims directly (not using addBusinessClaims to avoid duplication)
        await admin.auth().setCustomUserClaims(uid, {
          businessIds,
          roles,
        });

        console.log(`  ✅ ${uid}: ${businessIds.length} business(es), roles: ${roles.join(", ")}`);
        successCount++;
      } catch (error: any) {
        console.error(`  ❌ ${uid}: ${error.message}`);
        errorCount++;
      }
    }

    // ========================================
    // 4. SUMMARY
    // ========================================
    console.log("\n" + "=".repeat(50));
    console.log("📊 BACKFILL SUMMARY");
    console.log("=".repeat(50));
    console.log(`✅ Success: ${successCount} users`);
    console.log(`❌ Errors: ${errorCount} users`);
    console.log(`📋 Total memberships: ${memberships.length}`);
    console.log(`👥 Unique users: ${userMemberships.size}`);
    console.log("=".repeat(50));

    console.log("\n⚠️  IMPORTANT: Users must sign out and sign in again to get new claims!");

  } catch (error) {
    console.error("❌ Fatal error during backfill:", error);
    throw error;
  }
}

// If running directly (not as a Cloud Function)
if (require.main === module) {
  // Initialize admin if not already initialized
  if (admin.apps.length === 0) {
    admin.initializeApp();
  }

  backfillClaims()
    .then(() => {
      console.log("\n✅ Backfill completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Backfill failed:", error);
      process.exit(1);
    });
}





