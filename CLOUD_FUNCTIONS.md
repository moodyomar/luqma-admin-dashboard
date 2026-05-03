# Cloud Functions — single source of truth (Luqma / QBMenu / Jeeb)

This document applies to the **shared Firebase project** used by the Luqma menu app, Refresh, and other brands on **`qbmenu-7963c`** (see `.firebaserc` `default`). White-label apps that use **their own** Firebase project follow `MenuAppTemplate/SCALABLE_MENU_APP_WORKFLOW.md` for **their** deploys.

## What to deploy (order + customer push + referral)

All **customer order notifications**, **referral push**, and the **shared Expo push pipeline** live in **this repo**:

| Path | Role |
|------|------|
| `functions/src/customerExpoPush.ts` | Resolves `users/{uid}` (prefer **`order.userId`**, then phone), Expo batches, excludes driver tokens |
| `functions/src/customerNotifications.ts` | `onOrderCreated`, `onOrderStatusChange` |
| `functions/src/referralFunctions.ts` | `onReferralCodeApplied` |
| `functions/src/notifyDriversOnOrderUpdate.ts` | Driver-facing triggers (deploy with full `functions` when you change drivers) |

**Deploy only from `admin-dashboard`:**

```bash
cd /path/to/luqma/admin-dashboard
npm --prefix functions run build   # optional; predeploy runs tsc
npx firebase deploy --only functions:onOrderCreated,functions:onOrderStatusChange,functions:onReferralCodeApplied
```

Or use the npm script (requires `firebase-tools` in this package):

```bash
npm run deploy:functions:core
```

Full functions release:

```bash
npm run deploy:functions
```

## Do **not** do this (causes drift and silent breakage)

1. **Do not deploy `luqma/menu-app/functions` to `qbmenu-7963c`**  
   That package still defines `exports.onOrderCreated` / `exports.onOrderStatusChange`. A second deploy **replaces** the same trigger names with older or divergent logic (phone-only lookup, wrong status filters, no `userId` resolution). Symptom: **no `notificationLogs` / no push on Luqma or Refresh while Risto (other project) still works.**

2. **Do not “fix” push in the mobile repo only** for this backend — the menu app only registers tokens; **delivery** is server-side here.

## After changing function code

1. Commit in `luqma` (GitHub is for history/CI — **Firebase deploy reads local files**).  
2. Run deploy as above.  
3. Smoke-test on a **physical device**: new order → ready → delivered (pickup and delivery).  
4. Check **Firestore `notificationLogs`** and **Functions → Logs** for `[customerExpoPush]`.

## Per-brand white-label clients (Risto, Safaa, …)

Each client **Firebase project** should deploy the **template** functions copied by `update-client.sh` (dashboard + optional mobile bundle per `SCALABLE_MENU_APP_WORKFLOW.md`). They do **not** use this file’s deploy commands unless their `projectId` is this same backend.

## Maintenance checklist (avoid weekly surprises)

- [ ] One engineer owns **`admin-dashboard/functions`** for QBMenu; changes are reviewed against **`menu-app/functions/index.js`** only as **reference**, not as a second deploy target.  
- [ ] Any new **order-triggered** behavior is added under `functions/src/` here and exported from `functions/src/index.ts`.  
- [ ] `sync-template.sh` → `MenuAppTemplate` updates white-label **app** code; **this** folder is the backend SOT for **`qbmenu-7963c`**.  
- [ ] Before archiving old code, grep `menu-app/functions` for `exports.onOrder` and treat it as **legacy** for this project.
