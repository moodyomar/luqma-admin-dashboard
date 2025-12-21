#!/usr/bin/env node
/**
 * Quick script to set jeeb_driver custom claims for an existing user
 * 
 * Usage:
 *   npm run build
 *   node lib/tools/setJeebDriverClaims.js <email>
 * 
 * Or modify the email in this file and run directly
 */

import * as admin from "firebase-admin";

// Initialize Firebase Admin with explicit project ID for local execution
if (!admin.apps.length) {
  // Try to get project ID from environment or use default
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "qbmenu-7963c";
  
  admin.initializeApp({
    projectId: projectId,
  });
  
  console.log(`🔧 Initialized Firebase Admin with project: ${projectId}`);
}

async function setJeebDriverClaims(email: string) {
  try {
    console.log(`🔍 Looking up user: ${email}`);
    const user = await admin.auth().getUserByEmail(email);
    
    console.log(`✅ Found user: ${user.uid}`);
    console.log(`📋 Current claims:`, user.customClaims || {});
    
    // Set jeeb_driver role
    await admin.auth().setCustomUserClaims(user.uid, {
      roles: ["jeeb_driver"],
    });
    
    console.log(`✅ Successfully set jeeb_driver claims for ${email} (${user.uid})`);
    console.log(`📋 New claims: { roles: ["jeeb_driver"] }`);
    console.log(`\n⚠️  User must sign out and sign in again for claims to take effect!`);
    
    return user.uid;
  } catch (error: any) {
    if (error.code === "auth/user-not-found") {
      console.error(`❌ User not found: ${email}`);
    } else {
      console.error(`❌ Error:`, error.message);
    }
    throw error;
  }
}

// Get email from command line argument or use default
const email = process.argv[2] || "zayn@driver.com"; // Default to existing driver

setJeebDriverClaims(email)
  .then(() => {
    console.log("\n✅ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Failed:", error);
    process.exit(1);
  });

