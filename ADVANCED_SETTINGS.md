# Advanced Settings (code-only access)

Advanced Settings is a page in the admin dashboard where you can:

- **Enable/disable** credit card (Tranzila) and Apple Pay
- **Enter and update** Tranzila and Apple Pay API keys in a form (no manual Firestore editing)
- **Edit theme colors** (primary, secondary, background, text, muted, border, etc.) — saved to `config.colors`; the menu app uses them at runtime so changes apply without rebuilding

Changes are written to Firestore (`config.features`, `config.payment`, `config.colors`) and apply to the menu app immediately without rebuilding.

---

## Who can see it

Only emails listed in **`VITE_ADVANCED_SETTINGS_EMAILS`** (admin-dashboard `.env`) can see **إعدادات متقدمة** in the sidebar and open the page. List only **developer** emails; do not add the business owner or employees.

---

## Setup (two steps)

### 1. Add the developer user in Firebase

The developer email must exist in **Firebase Authentication** and have **admin** access to the business so they can log in to the dashboard.

**From أدوات التطوير (Developer Tools):**  
1. Log in as an existing admin.  
2. Open **أدوات التطوير** from the sidebar (only in dev mode).  
3. Enter the **Debug Tools password** (set in `.env` as `VITE_DEBUG_TOOLS_PASSWORD`).  
4. Use the **إضافة مسؤول (Admin)** form: enter the developer email (e.g. `info@qbmedia.co.il`), password, optional name, and click **إضافة مسؤول**.  
5. The new admin can then sign in and choose the Admin role.

**Option B – Firebase Console**  
Create the user in Authentication, then set custom claims so `businessIds` includes the business id and `roles` includes `admin`.

### 2. Allowlist the developer email in the dashboard

In **admin-dashboard** `.env` add (use your actual developer email):

```env
VITE_ADVANCED_SETTINGS_EMAILS=info@qbmedia.co.il
```

For multiple developers, comma-separated, no spaces:

```env
VITE_ADVANCED_SETTINGS_EMAILS=dev1@company.com,dev2@company.com
```

Restart the dev server (`npm run dev` or `yarn dev`) so Vite picks up the variable.

---

## Production build (Advanced Settings must show)

The allowlist is **inlined at build time**. If you build without `VITE_ADVANCED_SETTINGS_EMAILS` set (e.g. empty in `.env` or not set in your CI/hosting env), **no one** will see Advanced Settings or Debug Tools in production.

**CLI fix (run from admin-dashboard):**

1. **Ensure .env has at least one email** (editing `.env` or using the script):
   ```bash
   npm run ensure:advanced-settings-env
   ```
   If the script exits with an error, add your email(s) to `VITE_ADVANCED_SETTINGS_EMAILS` in `.env`, then run it again.

2. **Build for production** (ensure + build in one step):
   ```bash
   npm run build:production
   ```
   Or run `npm run build` only after confirming `.env` has `VITE_ADVANCED_SETTINGS_EMAILS` set.

3. **Optional: verify** that the built bundle contains the allowlist:
   ```bash
   npm run build && npm run verify:build
   ```

If you deploy via Vercel/Netlify/CI: add `VITE_ADVANCED_SETTINGS_EMAILS` to the **build** environment variables (same value as in `.env`), then trigger a new build and redeploy.

---

### 3. Sign in and use

Sign in to the dashboard with the developer email (and choose **Admin** role when prompted). You will see **إعدادات متقدمة** in the sidebar. Open it to manage payment toggles and API keys.

---

## Security

- The allowlist is in your repo/env; only you control which emails are listed.
- Do not commit real API keys; keep `.env` in `.gitignore`.
- Firestore rules still apply: only users who can write to `menus/{businessId}` can save from Advanced Settings.
