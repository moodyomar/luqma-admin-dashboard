# POS + H10: Build, Install, Debug, Print

**Source of truth for every menu app (Refresh, Risto, Safaa, etc.).**  
Use this when you need to build the POS APK, install it on the H10, debug (logcat / Chrome inspect), or fix printing.  
**No GitHub or Vercel here** — only APK, device, debugging, and printer.

---

## 1. Per-project config (before building)

Each dashboard has its own `pos-print-sdk`. Set **dashboard URL** and **brand** for that project.

**File:** `<dashboard>/pos-print-sdk/poswebview/src/main/res/values/strings.xml`

| String | Use for |
|--------|---------|
| `admin_dashboard_url` | URL the app loads (e.g. `https://refresh-dashboard.vercel.app/`) |
| `brand_name` | English name on receipts |
| `brand_name_ar` | Arabic name on receipts |
| `brand_name_ar_short` | Short Arabic (receipt footer) |
| `app_name` | App launcher name (e.g. "Refresh POS") |

**Receipt logo:**  
- To show your logo on the receipt: add `receipt_logo.png` to `pos-print-sdk/poswebview/src/main/res/drawable/`.  
- To show only text (no image): leave that folder without `receipt_logo.png` — the app will show the brand name from `strings.xml`.

---

## 2. Build the APK

**Option A – Android Studio**

1. Open Android Studio → **File → Open**.
2. Open the **pos-print-sdk** folder of your project (e.g. `.../refresh-dashboard/pos-print-sdk`).
3. Wait for Gradle sync. If "SDK location not found", create `local.properties` in `pos-print-sdk` with:  
   `sdk.dir=$HOME/Library/Android/sdk`
4. **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
5. Note the APK path: `poswebview/build/outputs/apk/debug/poswebview-debug.apk`

**Option B – Terminal**

```bash
cd /path/to/<project>-dashboard/pos-print-sdk
./gradlew assembleDebug
```

APK output: `poswebview/build/outputs/apk/debug/poswebview-debug.apk`

---

## 3. Install on the H10

**On the H10 (one-time):**

1. **Settings → About device** → tap **Build number** 7 times.
2. **Settings → Developer options** → turn on **USB debugging** (and **Install via USB** if shown).

**On the Mac:**

1. Connect H10 with USB. Allow USB debugging when prompted on the H10.
2. Run:

```bash
adb devices
# Should show your device as "device"

cd /path/to/<project>-dashboard/pos-print-sdk
adb install -r poswebview/build/outputs/apk/debug/poswebview-debug.apk
```

`-r` = replace existing install. If "no devices", unplug/replug and run `adb kill-server && adb devices`.

---

## 4. Debugging

### A. See printer / app logs (why "printer not initialized", etc.)

1. Connect H10 via USB.
2. On Mac:

```bash
adb logcat -c && adb logcat POS:V *:S
```

3. On the H10: open the POS app (or restart it). Watch the terminal for:
   - `Bluetooth is enabled, searching for paired devices...`
   - `Found paired device: InnerPrinter (...)` or `Could not connect to InnerPrinter`

If you get no output, try:

```bash
adb logcat | grep -iE "POS|Bluetooth|InnerPrinter|printer"
```

### B. See dashboard errors (login, network, JS)

1. Connect H10 via USB. Open the POS app on the H10.
2. On Mac: open Chrome → go to **`chrome://inspect`**.
3. Under **Remote Target**, find the WebView (e.g. "WebView in com.luqma.pos") → click **inspect**.
4. In DevTools use **Console** and **Network** while you use the app (e.g. try to log in).

(WebView debugging is enabled in the app code; if the WebView doesn’t appear, rebuild and reinstall the APK once.)

---

## 5. Printing

**"Printer not initialized"** means the app couldn’t connect to the H10’s internal printer over Bluetooth.

**Do this on the H10:**

1. **Settings → Bluetooth** → turn **On**.
2. In Bluetooth, find **"InnerPrinter"** (or similar) under Available/Paired and **pair** it if needed.
3. **Settings → Apps → [Your POS app]** → **Permissions** → enable **Bluetooth** (and **Nearby devices** if shown).
4. Fully close the POS app and open it again.

**Check what the app sees:** use the logcat command in section 4A and look for the Bluetooth / InnerPrinter lines.

**Receipt logo:**  
- Logo image: put `receipt_logo.png` in `pos-print-sdk/poswebview/src/main/res/drawable/`, then rebuild and reinstall.  
- Text only: remove or don’t add `receipt_logo.png`; the receipt will show the brand name from `strings.xml`.

---

## 6. Quick command reference

| What | Command |
|------|--------|
| Build APK | `cd <path-to-pos-print-sdk> && ./gradlew assembleDebug` |
| Install APK | `adb install -r poswebview/build/outputs/apk/debug/poswebview-debug.apk` |
| Printer logs | `adb logcat -c && adb logcat POS:V *:S` then open/restart app on H10 |
| Dashboard debug | Chrome → `chrome://inspect` → inspect WebView |

---

## 7. Paths (examples)

| Project | pos-print-sdk path |
|---------|--------------------|
| Refresh | `MenuAppTemplate/Clients/refresh/refresh-dashboard/pos-print-sdk` |
| Risto | `MenuAppTemplate/Clients/risto/risto-dashboard/pos-print-sdk` |
| Safaa | `MenuAppTemplate/Clients/safaa/safaa-dashboard/pos-print-sdk` |
| Luqma | `luqma/admin-dashboard/pos-print-sdk` |

---

**This file is the only reference you need for: build → install → debug → print.**  
For deployment (GitHub, Vercel), use your existing setup or `DASHBOARD_REPOS.md`. For more detail on printer hardware or kiosk mode, see `H10_POS_DEPLOYMENT_GUIDE.md` and `pos-print-sdk/ADD_YOUR_LOGO.md`.
