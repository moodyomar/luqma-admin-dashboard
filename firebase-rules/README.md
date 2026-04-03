# Firestore rules in this repo

## Single source of truth for Luqma / QBMenu / Jeeb

| File | Role |
|------|------|
| **`../firestore.rules`** (i.e. `admin-dashboard/firestore.rules`) | **Only file to edit** for the main Luqma project. Includes white-label–style rules **plus** Jeeb collections (`businesses`, `client_requests`, `jeeb_clients`), public `menus/.../orders` reads for cross-project tooling, referrals, coupons, notifications, etc. `firebase.json` points here. |

## Deploy

```bash
cd admin-dashboard
npm run rules:deploy
# or: firebase deploy --only firestore:rules
```

**Jeeb driver app** (or any other repo): do not keep a second copy of these rules long term. Either deploy from `admin-dashboard` with the correct Firebase project, or add a short doc in that repo linking here and paste only when intentionally mirroring.

## White-label tenants (Risto, Bunelo, …)

| File | Role |
|------|------|
| **`firebase-template.rules`** | Shared rules for clients that **do not** use Jeeb top-level collections. Edit here when all tenants need the same change. |
| **`bunelo.rules`**, **`risto.rules`**, … | Copies of the template; refresh with `npm run sync:firestore-tenant-rules`. |

When the template gains a feature Luqma also needs, update **`firebase-template.rules`**, run the sync script, then **merge the same block into `../firestore.rules`** in the right section (Luqma is the superset).

## Template sync (`sync-template.sh`)

`sync-template.sh` rsyncs **`firebase-rules/`** to MenuAppTemplate. Luqma’s canonical rules are **not** inside `firebase-rules/`; they live in **`firestore.rules`**. After changing `firestore.rules`, deploy from this dashboard as above.
