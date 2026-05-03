# Cloud Functions — single source of truth (Luqma + Jeeb on `qbmenu-7963c`)

Firebase project **`qbmenu-7963c`** (**QBMenu** in the console) is shared **only** by **Luqma** and **Jeeb**. Every other menu app—existing clients and future ones—uses **its own** Firebase project and does **not** use this document’s deploy commands.

White-label clients follow `MenuAppTemplate/SCALABLE_MENU_APP_WORKFLOW.md` and deploy template functions to **their** `projectId`. See `.firebaserc` `default` in this repo for QBMenu.

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
   That package still defines `exports.onOrderCreated` / `exports.onOrderStatusChange`. A second deploy **replaces** the same trigger names with older or divergent logic (phone-only lookup, wrong status filters, no `userId` resolution). Symptom: **no `notificationLogs` / no push for Luqma and Jeeb on `qbmenu-7963c`**, while e.g. Risto on **its own** project still works.

2. **Do not “fix” push in the mobile repo only** for this backend — the menu app only registers tokens; **delivery** is server-side here.

## After changing function code

1. Commit in `luqma` (GitHub is for history/CI — **Firebase deploy reads local files**).  
2. Run deploy as above.  
3. Smoke-test on a **physical device**: new order → ready → delivered (pickup and delivery).  
4. Check **Firestore `notificationLogs`** and **Functions → Logs** for `[customerExpoPush]`.

## Per-brand white-label clients (Refresh, Risto, Safaa, …)

Each **white-label** client **Firebase project** should deploy the **template** functions copied by `update-client.sh` (dashboard + optional mobile bundle per `MenuAppTemplate/SCALABLE_MENU_APP_WORKFLOW.md`). No client except **Luqma and Jeeb** shares **`qbmenu-7963c`**; those two use this file’s deploy commands. **Future** clients must **not** be added to `qbmenu-7963c`—give each a **new** project.

## Maintenance checklist (avoid weekly surprises)

- [ ] One engineer owns **`admin-dashboard/functions`** for QBMenu; changes are reviewed against **`menu-app/functions/index.js`** only as **reference**, not as a second deploy target.  
- [ ] Any new **order-triggered** behavior is added under `functions/src/` here and exported from `functions/src/index.ts`.  
- [ ] `sync-template.sh` → `MenuAppTemplate` updates white-label **app** code; **this** folder is the backend SOT for **`qbmenu-7963c`**.  
- [ ] Before archiving old code, grep `menu-app/functions` for `exports.onOrder` and treat it as **legacy** for this project.
