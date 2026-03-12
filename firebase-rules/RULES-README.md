# Firebase Rules — Source of Truth & Client Status

## Source of truth: `firebase-template.rules`

Use **`firebase-template.rules`** when creating or updating Firestore rules for any **new client project** (except Luqma). Luqma keeps its own rules because of Jeeb-specific collections and behavior.

**All non-Luqma clients use the same rules.** The files `safaa.rules`, `bunelo.rules`, `risto.rules`, `icon.rules`, and `refresh.rules` are identical (copy of the template). Update the template first, then copy to each client file when deploying.

The template includes:

- **Permissions:** `isAuthed`, `hasBiz`, `isAdmin`, `isDriver`, `isJeebDriver`, `isBusinessAdmin`
- **Notifications:** `notificationLogs` (split-bill sessions), `menus/{businessId}/notifications`
- **Redeem points:** `users/{uid}` readable/updatable by owner (and admin)
- **Jeeb app:** `orders` read allowed for all (so Jeeb drivers in another Firebase project can read); order updates by admin or drivers (including `jeeb_driver`)
- **Referral:** `users/{uid}/referralTransactions` and `referralStats` (read own, admin create/update/delete)
- **New order / status change / refer-code notifications:** handled by Cloud Functions; rules allow admins to write `menus/{businessId}/notifications` and allow needed reads on `users`

Do **not** add Luqma-only collections: `/businesses`, `/client_requests`, `/jeeb_clients`.

---

## Client status (vs template)

| Client   | Rules file        | Notes |
|----------|-------------------|--------|
| **Safaa**  | Same as template | Copy `safaa.rules` to Firebase. |
| **Bunelo** | Same as template | Copy `bunelo.rules` to Firebase. |
| **Risto**  | Same as template | Copy `risto.rules` to Firebase. |
| **Icon**   | Same as template | Copy `icon.rules` to Firebase. |
| **Refresh**| Same as template | Copy `refresh.rules` to Firebase. |
| **Luqma**  | Different        | Uses `luqma.rules` only (has `/businesses`, `/client_requests`, `/jeeb_clients`). Do not use template. |

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

- **All non-Luqma clients:** same rules — use `firebase-template.rules` or any of `safaa.rules`, `bunelo.rules`, `risto.rules`, `icon.rules`, `refresh.rules`.
- **Luqma:** use `luqma.rules` only; do not replace with template.
- **To change rules for all non-Luqma clients:** edit `firebase-template.rules`, then copy its content (from `rules_version` onward) into the five client files, or keep client files in sync manually.
