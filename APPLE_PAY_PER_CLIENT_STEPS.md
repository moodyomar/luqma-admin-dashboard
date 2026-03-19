# Apple Pay per client – where things live and what to do

## Where is the “generic page”?

| Location | Purpose |
|----------|---------|
| **luqma** `menu-app/public/tranzila-applepay.html` | Canonical source (edit here; then run `sync-template.sh` so the template gets it). |
| **luqma** `menu-app/public/.well-known/apple-developer-merchantid-domain-association` | Apple Pay domain verification file (optional; include if you verify that domain). |
| **MenuAppTemplate** `Menu-reactnative/public/tranzila-applepay.html` | Copy used when you run `update-client.sh` (synced from luqma). |
| **Per client** `Clients/<client>/<client>-mobile/public/tranzila-applepay.html` | Copy you deploy to **that client’s** Firebase Hosting. |

You do **not** need to open the luqma repo in Cursor for “just deploy” – only if you change the generic page. For adding Apple Pay to a new client, work from **MenuAppTemplate** (or open `Clients/<client>` in Cursor).

---

## Do you need to access each client directory?

Yes. For each client you must:

1. Use that client’s **menu app** folder (e.g. `safaa-mobile`).
2. Run Firebase commands from that folder so Hosting deploys to **that client’s** Firebase project.

You can do it all from **one Cursor window** with the repo at **MenuAppTemplate** and terminal `cd` into each client when needed.

---

## One Cursor window or two?

- **One window (recommended):** Open **MenuAppTemplate** in Cursor. Use the terminal to `cd` into `Clients/safaa/safaa-mobile`, then run the deploy. Repeat for other clients by `cd`-ing into their `Clients/<client>/<client>-mobile`.
- **Two windows:** One for luqma (when you edit the generic page / run sync), one for MenuAppTemplate (when you deploy per client). Optional.

---

## Walkthrough: Safaa (then repeat for others)

Path you gave: `/Users/moody/Documents/Dev/MenuAppTemplate/Clients/safaa`.

### 1. Open the right project in Cursor

- Open **MenuAppTemplate** in Cursor (root: `/Users/moody/Documents/Dev/MenuAppTemplate`).  
- You can also open only `Clients/safaa` if you prefer; the important part is having the **safaa-mobile** folder available.

### 2. Ensure the generic page is in the client

Safaa already has it at:

`Clients/safaa/safaa-mobile/public/tranzila-applepay.html`

If for another client the file is missing, copy from the template:

```bash
# From MenuAppTemplate root
cp Menu-reactnative/public/tranzila-applepay.html Clients/<client>/<client>-mobile/public/
# Optional: domain verification
mkdir -p Clients/<client>/<client>-mobile/public/.well-known
cp Menu-reactnative/public/.well-known/apple-developer-merchantid-domain-association \
   Clients/<client>/<client>-mobile/public/.well-known/
```

(Replace `<client>` with e.g. `safaa`, `risto`, `refresh`.)

### 3. Deploy Hosting for that client

From a terminal (same Cursor window is fine):

```bash
cd /Users/moody/Documents/Dev/MenuAppTemplate/Clients/safaa/safaa-mobile

# Use Safaa’s Firebase project (projectId from constants/firebaseConfig.js)
firebase use safaa-menu-app

# Deploy only Hosting (no functions/rules)
firebase deploy --only hosting
```

After this, the page is live at:

`https://safaa-menu-app.web.app/tranzila-applepay.html`

### 4. Configure in the admin dashboard (Advanced Settings)

- Log in to the **Safaa** admin dashboard (the one that uses Safaa’s Firebase/business).
- Go to **Advanced Settings** (إعدادات متقدمة).
- **Apple Pay** section:
  - Turn **Apple Pay** on.
  - **Tranzila terminal**: Safaa’s terminal name (from Tranzila; e.g. if they have a different one than Luqma).
  - **Merchant ID**: e.g. `merchant.com.safaa` (or whatever you use in Tranzila/Apple).
  - **Country** / **Currency**: e.g. IL / ILS.
  - **Hosting URL**: Leave **empty** so the app uses `https://safaa-menu-app.web.app`, or set it explicitly to that URL.
- Save.

### 5. Tranzila: allow domain + Apple Pay for this terminal

- In **Tranzila** ([my.tranzila.com](https://my.tranzila.com)): for this client’s terminal, enable **Apple Pay** and **iframe** (e.g. Settings → iframe; Payment options).
- **Ask Tranzila to allow the domain** for that terminal (e.g. `https://safaa-menu-app.web.app`). Until they add the domain, Apple Pay can show "Payment Not Completed" even when the page and `.well-known` are deployed.
- Ensure `.well-known/apple-developer-merchantid-domain-association` is deployed (step 2) and that `firebase.json` does **not** use `"**/.*"` in `hosting.ignore` (update-client.sh auto-fixes this when you run it for the client).

---

## Scalable script behavior

- **update-client.sh** (MenuAppTemplate): when you run it for a client’s **mobile** app, it automatically patches that client’s `firebase.json` if `hosting.ignore` contains `"**/.*"`, replacing it with a safe list so the `.well-known` folder is deployed. Existing and future clients get the fix without manual edits.
- **After “Update ALL clients”:** You still need to deploy Hosting per client so the Apple Pay page (and `.well-known`) go live. The script does **not** run `firebase deploy --only hosting` for you. At the end of a bulk update it prints one ready-to-run command per client (with that client’s projectId). Copy and run each line from the MenuAppTemplate root, or run them one by one from each client’s `Clients/<client>/<client>-mobile` folder.

---

## Reuse for another client (e.g. Risto, Refresh)

Same flow, different paths and project ID:

```bash
cd /Users/moody/Documents/Dev/MenuAppTemplate/Clients/<client>/<client>-mobile
firebase use <client-firebase-project-id>
firebase deploy --only hosting
```

Get `<client-firebase-project-id>` from:

`Clients/<client>/<client>-mobile/constants/firebaseConfig.js` → `projectId`.

Then in Advanced Settings for **that** client: enable Apple Pay, set that client’s terminal and Hosting URL (or leave empty to use `https://<project-id>.web.app`).

---

## Copy-paste “prompt” you can use in Cursor for each client

When you open a client (e.g. Safaa) in Cursor and want a reminder of what to do, you can paste something like:

```
I’m setting up Apple Pay for client “Safaa”. Path: /Users/moody/Documents/Dev/MenuAppTemplate/Clients/safaa.

1) Ensure Clients/safaa/safaa-mobile/public/tranzila-applepay.html exists (copy from Menu-reactnative/public/ if missing).
2) From Clients/safaa/safaa-mobile run: firebase use <projectId from constants/firebaseConfig.js>, then firebase deploy --only hosting.
3) I’ll then set Apple Pay + Tranzila terminal and Hosting URL (or leave empty) in Advanced Settings for Safaa.
```

For another client, replace “Safaa” and the path with that client’s name and `Clients/<client>`.

---

## Summary

- **Generic page:** luqma `menu-app/public/` (source) → template `Menu-reactnative/public/` → each client `Clients/<client>/<client>-mobile/public/` (deploy from here).
- **One Cursor window:** MenuAppTemplate; terminal `cd` into each `Clients/<client>/<client>-mobile` to deploy.
- **Per client:** Copy page if missing → `firebase use <projectId>` → `firebase deploy --only hosting` → Advanced Settings: Apple Pay on + terminal + (optional) Hosting URL.
