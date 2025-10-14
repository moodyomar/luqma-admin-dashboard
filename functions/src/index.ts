import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
admin.initializeApp();

// Export Cloud Functions
export { inviteUser } from "./inviteUser";
export { addBusinessClaims, removeBusinessClaims, forceTokenRefresh } from "./setClaims";





