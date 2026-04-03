# 🔥 Deploy Firestore Rules

Canonical rules for Luqma / QBMenu / Jeeb: **`firestore.rules`** in this folder (see `firebase-rules/README.md`). Do not maintain a duplicate `luqma.rules`.

**Compared to the long-running production rules (menus, users, referrals, coupons, etc.):** the file is the same, plus three top-level matches: **`businesses`**, **`client_requests`**, **`jeeb_clients`**. Those paths were missing in production, so Jeeb admin hit the final deny rule. Deploying this file does not change `menus/*`, order read policy (`isAuthed()`), or global drivers (`isJeebDriver` + admin).

## Quick Deploy

```bash
cd admin-dashboard
npm run rules:deploy
# or: firebase deploy --only firestore:rules
```

## If Node Version Issue

If you get a Node version error:

```bash
# Use nvm to switch to Node 20 (as specified in .nvmrc)
nvm use 20

# Then deploy
firebase deploy --only firestore:rules
```

## Verify Rules are Deployed

After deploying, the rules should be active immediately. Try the delete operation again.

## Alternative: Deploy via Firebase Console

If CLI doesn't work:

1. Go to [Firebase Console](https://console.firebase.google.com/project/qbmenu-7963c/firestore/rules)
2. Copy the contents of `firestore.rules`
3. Paste into the Rules editor
4. Click **Publish**

---

## Jeeb admin (`admin.jeeb.delivery`) — OAuth + `businesses` permissions

Two separate issues often show up together; fix **both** on the **same** Firebase project your Jeeb admin uses (e.g. QBMenu / `qbmenu-7963c`).

### 1. “Domain is not authorized for OAuth operations”

Firebase Auth only allows sign-in from approved hostnames.

1. Open [Firebase Console](https://console.firebase.google.com) → select the project Jeeb admin uses.
2. **Authentication** → **Settings** → **Authorized domains**.
3. Add: **`admin.jeeb.delivery`** (and **`localhost`** for local dev if you use it).
4. Save. Hard-refresh the app or try again in a private window.

Without this, `signInWithPopup` / `signInWithRedirect` can fail, **`request.auth` stays null**, and Firestore correctly returns **Missing or insufficient permissions** for rules that require `isAuthed()`.

### 2. “Error loading businesses” / Firestore permission denied

The `businesses` collection is allowed for **authenticated** users in **`firestore.rules`** (`allow read: if isAuthed()`). If you still see permission errors:

1. Deploy rules from this repo (see **Quick Deploy** above) to that same project.
2. Confirm the Jeeb admin app’s **`firebaseConfig`** (`apiKey`, `projectId`, etc.) matches that project—not another client’s project.
3. After fixing OAuth, sign in again and confirm the session exists (Firebase Auth user in DevTools / Application).

### 3. Google Sign-In (optional extra check)

If you use Google as a provider and issues persist, in [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → **Credentials** → your OAuth 2.0 Client → ensure **Authorized JavaScript origins** includes `https://admin.jeeb.delivery`. Firebase “Authorized domains” fixes most cases; this is a fallback.

---

## Admin SPA → Gen2 callable CORS (`sendAdminPromotionalPush`, etc.)

If the browser shows **CORS** / **No Access-Control-Allow-Origin** on `*.cloudfunctions.net/...` from `https://admin.luqma.co.il` (or another custom admin host), the project is not “corrupted”: **Gen2 callables run on Cloud Run**. The **OPTIONS** preflight has **no** Firebase ID token. If the service is not **publicly invokable** at the edge, preflight fails before your code runs.

**Fix (in this repo):** admin callables use **`adminSpaCallableOptions.ts`** with **`invoker: "public"`** plus **`cors: true`**. Auth is still enforced in the handler via **`request.auth`**.

**Deploy after changing callables:**

```bash
cd admin-dashboard
firebase deploy --only functions:sendAdminPromotionalPush,functions:sendPromotionalNotification,functions:resetReferralData
```

**Prevention:** Do not remove **`invoker: "public"`** from these callables when editing options. For new admin-only Gen2 `onCall` functions called from the browser, reuse **`adminSpaCallableOpts`**.
