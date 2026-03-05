# Advanced Settings (code-only access)

Advanced Settings is a page in the admin dashboard where you can:

- **Enable/disable** credit card (Tranzila) and Apple Pay
- **Enter and update** Tranzila and Apple Pay API keys in a form (no manual Firestore editing)

Changes are written to Firestore (`config.features`, `config.payment`) and apply to the menu app immediately without rebuilding.

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

### 3. Sign in and use

Sign in to the dashboard with the developer email (and choose **Admin** role when prompted). You will see **إعدادات متقدمة** in the sidebar. Open it to manage payment toggles and API keys.

---

## Security

- The allowlist is in your repo/env; only you control which emails are listed.
- Do not commit real API keys; keep `.env` in `.gitignore`.
- Firestore rules still apply: only users who can write to `menus/{businessId}` can save from Advanced Settings.
