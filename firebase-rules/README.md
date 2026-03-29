# Firestore rules in this repo

## Two sources of truth

| File | Role |
|------|------|
| **`firebase-template.rules`** | **Shared** rules for every white-label client (Risto, Bunelo, Icon, Safaa, Refresh, …). Edit here first when you add features that all tenants need (coupons, `couponUserUsage`, orders, drivers, etc.). |
| **`luqma.rules`** | **Luqma only** = same base as the template **plus** extra collections and rules (Jeeb: `businesses`, `client_requests`, `jeeb_clients`, and any Luqma-specific tweaks). Do **not** overwrite this file with the template. |

## Deploy file for Luqma main project

`firebase.json` points Firestore at **`../firestore.rules`** (repo root: `admin-dashboard/firestore.rules`).  
Keep it in sync with **`firebase-rules/luqma.rules`** when you change Luqma rules:

```bash
cd admin-dashboard
cp firebase-rules/luqma.rules firestore.rules
firebase deploy --only firestore:rules
```

(Or maintain `firestore.rules` as the edited file and periodically copy back to `luqma.rules` — pick one workflow and stick to it.)

## Propagate template → all tenant `.rules` files

After you change **`firebase-template.rules`**, copy it to every tenant file (except `luqma.rules`):

```bash
cd admin-dashboard
npm run sync:firestore-tenant-rules
# or: bash scripts/sync-firebase-tenant-rules.sh
```

Dry run:

```bash
bash scripts/sync-firebase-tenant-rules.sh --dry-run
```

Configured tenant names live in **`scripts/sync-firebase-tenant-rules.sh`** (`TENANTS` array). Add a new client by adding `firebase-rules/<client>.rules` and appending the name there.

## Template repo (`sync-template.sh`)

`sync-template.sh` rsyncs the whole **`firebase-rules/`** folder to MenuAppTemplate, then copies **`firebase-template.rules`** into the template apps’ `firestore.rules`.  
Run **`sync:firestore-tenant-rules`** in luqma **before** `sync-template.sh` so the template receives already-aligned tenant copies.

## Why not one file for everything?

Luqma ships Jeeb and internal collections that other restaurants do not have. Putting those in `firebase-template.rules` would expose or complicate every client project. The split keeps tenants minimal and Luqma explicit.

When you add a rule that **everyone** needs, change **`firebase-template.rules`**, run **`sync:firestore-tenant-rules`**, then **merge the same block into `luqma.rules`** in the right place (or diff template vs luqma and port only the delta).
