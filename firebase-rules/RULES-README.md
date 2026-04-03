# Firebase Rules — Source of Truth & Client Status

## Source of truth

- **Luqma / QBMenu / Jeeb:** **`admin-dashboard/firestore.rules`** only (superset). Deploy from `admin-dashboard` with `firebase deploy --only firestore:rules`. See **`README.md`** in this folder.

- **Other white-label clients:** **`firebase-template.rules`**. Files `safaa.rules`, `bunelo.rules`, `risto.rules`, `icon.rules`, `refresh.rules` track the template (`npm run sync:firestore-tenant-rules`).

Shared concepts in the template:

- **Permissions:** `isAuthed`, `hasBiz`, `isAdmin`, `isDriver`, `isJeebDriver`, `isBusinessAdmin`
- **Notifications:** `notificationLogs` (split-bill), `menus/{businessId}/notifications`
- **Redeem / users:** `users/{uid}` as documented in rules
- **Referral:** `referralTransactions`, `referralStats` under `users/{uid}`
- **Cloud Functions:** order/referral notifications; admins write `menus/.../notifications` where applicable

Do **not** put Luqma-only top-level collections in **`firebase-template.rules`**: `/businesses`, `/client_requests`, `/jeeb_clients` exist only in **`firestore.rules`**.

---

## Client status (vs template)

| Client   | Rules file        | Notes |
|----------|-------------------|--------|
| **Safaa**  | Same as template | Copy `safaa.rules` to Firebase. |
| **Bunelo** | Same as template | Copy `bunelo.rules` to Firebase. |
| **Risto**  | Same as template | Copy `risto.rules` to Firebase. |
| **Icon**   | Same as template | Copy `icon.rules` to Firebase. |
| **Refresh**| Same as template | Copy `refresh.rules` to Firebase. |
| **Luqma**  | **`admin-dashboard/firestore.rules`** | Superset (Jeeb + menu); not under `firebase-rules/*.rules`. |

---

## Template sync & deploy (MenuAppTemplate)

Rules and functions are applied to **all client projects** via:

1. **Sync (from luqma):** `./sync-template.sh`  
   - Syncs `admin-dashboard/firebase-rules/` → `MenuAppTemplate/firebase-rules/`  
   - Copies `firebase-template.rules` → `Dashboard-reactjs/firestore.rules` and `Menu-reactnative/firestore.rules`

2. **Update a client:** `./update-client.sh <client-id>`  
   - Copies template (including rules and both functions) into `Clients/<id>/`  
   - Can deploy Firestore rules + dashboard functions from dashboard, and **menu-app functions** from mobile (so points & notifications work).

3. **Deploy to all (or one) client:** From MenuAppTemplate, `./deploy-firebase-all.sh [client-id]`  
   - Copies template rules to each client’s dashboard and mobile, then deploys rules + dashboard functions + menu-app functions.

See **MenuAppTemplate/FIREBASE_DEPLOY.md** for the full flow and checklist.

---

## Summary

- **All non-Luqma clients:** same rules — use `firebase-template.rules` or synced `*.rules` files.
- **Luqma / QBMenu / Jeeb:** edit **`admin-dashboard/firestore.rules`** only; do not duplicate under `firebase-rules/`.
- **To change rules for all non-Luqma clients:** edit `firebase-template.rules`, then run `npm run sync:firestore-tenant-rules`. Merge any shared change into **`firestore.rules`** if Luqma needs it too.
