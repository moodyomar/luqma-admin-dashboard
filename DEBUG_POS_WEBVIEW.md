# Debugging the POS WebView (H10)

When the dashboard loads in the POS app but **login fails**, **images don't show**, or **printer shows "printer not initialized"**, use this.  
Replace `refresh-dashboard.vercel.app` / "Refresh" with your project's dashboard URL and app name where relevant.

---

## 1. Logo not showing (broken image)

**Cause:** The app shows an `<img>` for the brand logo. If `brandConfig.logoUrl` is empty, the image request fails and you see a broken icon.

**Fix (in template):** Login page shows the **brand name as text** when there's no logo URL. After sync + update, redeploy the dashboard so the POS loads the updated code.

**Optional:** To show a real logo, set a logo URL in `constants/brandConfig.js` (or via env `VITE_BRAND_LOGO`) and ensure the URL is publicly reachable.

---

## 2. Login failing ("فشل تسجيل الدخول")

### A. Firebase Authorized domains (most common)

Your dashboard runs at e.g. `https://<project>-dashboard.vercel.app`. Firebase only allows auth on domains you list.

1. Open [Firebase Console](https://console.firebase.google.com) → your project.
2. **Authentication** → **Settings** → **Authorized domains**.
3. Add your dashboard domain (e.g. `refresh-dashboard.vercel.app`). Save.

### B. See the real error (Chrome remote debugging)

The POS app has **WebView debugging enabled**. Connect H10 via USB, open the POS app, then on your Mac open Chrome → **`chrome://inspect`** → find the WebView → **inspect** → Console/Network. Try login again to see the real error.

### C. Environment variables on Vercel

Ensure Vercel env vars for the dashboard include `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, etc., and redeploy after changes.

---

## 3. Printer: "error: printer not initialized"

The app connects to the H10 printer over **Bluetooth**, looking for a paired device named **"InnerPrinter"** (or containing "Printer" or "H10").

**Do this:**

1. **Bluetooth ON** – H10 → Settings → Bluetooth → On.
2. **Pair the printer** – In Bluetooth settings, look for **"InnerPrinter"** or similar and pair it.
3. **App permissions** – Allow Bluetooth (and Nearby devices) for the POS app. If denied before: Settings → Apps → [Your POS app] → Permissions → enable Bluetooth.
4. **Restart the app** – Fully close the POS app and open it again.

**See what the app sees:** USB connect H10, run `adb logcat -s POS`, open the app. Look for "Bluetooth is enabled", "Found paired device: InnerPrinter", or "Could not connect to InnerPrinter". If your H10 doesn't list "InnerPrinter", check the device manual for the correct printer name/API.

---

## 4. Quick checklist

| Check | Where |
|-------|--------|
| Logo shows as text when no URL | Redeploy dashboard (template has conditional logo) |
| Dashboard domain in Firebase Authorized domains | Firebase Console → Authentication → Authorized domains |
| POS has internet | Device browser / Wi‑Fi |
| Real error message | Chrome `chrome://inspect` → WebView → Console / Network |
| Firebase config | Vercel env vars `VITE_FIREBASE_*` |
| Printer "not initialized" | Bluetooth On, pair InnerPrinter, grant permission, restart app |

---

## 5. Optional: test same credentials in browser

Open your dashboard URL in a browser and log in. If it works there but not on the POS, focus on Authorized domains and network on the POS. If it fails in the browser too, fix Firebase config or credentials first.
