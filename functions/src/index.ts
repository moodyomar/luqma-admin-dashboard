import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
admin.initializeApp();

// Export Cloud Functions
export { inviteUser } from "./inviteUser";
// setClaims helpers are imported by inviteUser/removeDriver only — not Cloud Functions (do not re-export).
export { removeDriver } from "./removeDriver";
export {
  sendAdminPromotionalPush,
  sendPromotionalNotification,
} from "./sendPromotionalNotification";

// Customer notifications (CRITICAL - restores customer notification system)
export { onOrderCreated, onOrderStatusChange } from "./customerNotifications";

// Driver notifications (NEW - for driver app, separate from customer notifications)
export { notifyDriversOnStatusChange, notifyDriversOnCreate } from "./notifyDriversOnOrderUpdate";

// Referral functions (for referral code system)
export { onReferralCodeApplied, resetReferralData } from "./referralFunctions";

// Driver password management
export { resetDriverPassword } from "./resetDriverPassword";

// Driver profile management
export { updateDriverProfile } from "./updateDriverProfile";

// Jeeb driver management
export { createJeebDriver } from "./createJeebDriver";

// Analytics: new users from Auth creation time (matches Firebase console "Created")
export { getAuthNewUserCounts } from "./getAuthNewUserCounts";






