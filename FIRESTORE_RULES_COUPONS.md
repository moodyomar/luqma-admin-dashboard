# Firestore rules – coupon permissions (source of truth)

## Problem

Creating, updating, or deleting coupons in the admin dashboard can fail with:

- **FirebaseError: Missing or insufficient permissions**
- **אין לך הרשאה לעדכן קופונים** (You don't have permission to update coupons)

This often reappears after deploying **other** things (e.g. Cloud Functions or rules from another app).

## Root cause

Firestore allows only one rules file per project. Whichever app runs `firebase deploy --only firestore:rules` (or `firebase deploy` without `--only functions`) overwrites the project’s rules.

- **admin-dashboard** has full tenant rules: coupon write requires `isBusinessAdmin(businessId) || isAdmin()` (custom claims: `businessIds`, `roles`).
- **menu-app** (and other apps) have a simpler rules file. It used to have **no** `coupons` block, so `menus/{id}/coupons` fell through to the catch‑all and got **allow write: false**. Deploying that file removed coupon write for everyone.

## Fix (already applied)

1. **menu-app/firestore.rules**  
   An explicit **coupons** block was added under `menus/{menuId}` so that when rules are deployed from menu-app, coupon writes are still allowed:

   ```text
   match /coupons/{couponId} {
     allow read: if true;
     allow create, update, delete: if request.auth != null;
   }
   ```

   **Do not remove this block** from menu-app. It is the safety net that keeps coupon permissions working if you deploy rules from menu-app.

2. **admin-dashboard/firestore.rules**  
   Unchanged. Coupon rules there remain:

   ```text
   allow write: if isBusinessAdmin(businessId) || isAdmin();
   ```

   Use this file when you want full tenant-scoped rules (businessIds/roles).

## How to deploy without breaking coupons

- **Deploy only functions (no rules):**  
  `firebase deploy --only functions`  
  or  
  `firebase deploy --only functions:onOrderCreated,functions:onOrderStatusChange`  
  Rules are not touched; coupon permissions stay as they are.

- **Deploy rules from admin-dashboard (full tenant rules):**  
  From **admin-dashboard** folder:  
  `firebase deploy --only firestore:rules`  
  Use this when you need the full admin-dashboard rule set (custom claims, businessIds, roles).

- **Deploy rules from menu-app:**  
  After the fix above, menu-app’s rules file includes the coupons block, so deploying from menu-app **no longer removes** coupon write. Prefer deploying rules from admin-dashboard when possible.

## Summary

- **Single source of truth for “coupons must keep working”:**  
  The **coupons** block under `menus/{menuId}` must exist in **every** rules file that can be deployed to this project (at least in menu-app and admin-dashboard). It is already in both.
- **No Cloud Functions change** was required; only Firestore rules and this doc were updated.
- **Other permissions** were not changed; only the coupons block was added in menu-app.
