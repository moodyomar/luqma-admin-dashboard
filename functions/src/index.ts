import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
admin.initializeApp();

// Export Cloud Functions
export { inviteUser } from "./inviteUser";
export { addBusinessClaims, removeBusinessClaims, forceTokenRefresh } from "./setClaims";
export { removeDriver } from "./removeDriver";
export { sendPromotionalNotification } from "./sendPromotionalNotification";

// Customer notifications (CRITICAL - restores customer notification system)
export { onOrderCreated, onOrderStatusChange } from "./customerNotifications";

// Driver notifications (NEW - for driver app, separate from customer notifications)
export { notifyDriversOnStatusChange, notifyDriversOnCreate } from "./notifyDriversOnOrderUpdate";






