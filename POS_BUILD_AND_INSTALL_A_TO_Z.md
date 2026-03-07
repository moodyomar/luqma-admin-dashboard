# POS App: Build & Install A–Z (H10 Terminal)

**Source of truth for building the POS WebView app and installing the APK on the H10 device.**  
Use this guide for every menu app (Luqma, Refresh, Risto, Bunelo, Icon, etc.). Only the **per-project config** (dashboard URL, brand name) changes.

**APK + H10 only (no GitHub/Vercel):** For only build, install, debugging, and printing, use **POS_H10_BUILD_INSTALL_DEBUG_PRINT.md** in this folder.

---

## What you’re building

- **Android WebView app** that loads your admin dashboard (Vercel or local dev).
- **Silent printing** via a JavaScript bridge (`window.PosPrinter`) — no browser print dialog.
- **H10 Wireless Data Terminal** (Android 14) with built-in thermal printer (Bluetooth / SENRAISE service).

Result: staff open one app on the H10, see orders, tap print → receipt prints with no dialogs.

---

## Prerequisites

| Item | Notes |
|------|--------|
| **Mac** | You’ll run Android Studio and `adb` from here |
| **Android Studio** | [Download](https://developer.android.com/studio) or `brew install --cask android-studio` |
| **JDK 11+** | Usually installed with Android Studio; else `brew install openjdk@11` |
| **H10 device** | Charged, same Wi‑Fi as Mac (for dev) or internet (for production dashboard) |
| **USB cable** | To connect H10 to Mac for `adb install` |

---

## Per-project config (do this first)

Each dashboard (e.g. Refresh, Risto) has its own `pos-print-sdk` copy. Before building, set **dashboard URL** and **brand** in that project.

**File to edit:**  
`<dashboard-root>/pos-print-sdk/poswebview/src/main/res/values/strings.xml`

| String | Meaning | Example (Refresh) |
|--------|--------|-------------------|
| `admin_dashboard_url` | URL the app loads | `https://refresh-dashboard.vercel.app/` |
| `brand_name` | English name on receipts | `Refresh` |
| `brand_name_ar` | Arabic name | `ريفرش` |
| `brand_name_ar_short` | Short Arabic (receipt footer) | `ريفرش` |
| `brand_name_he` | Hebrew (if needed) | `ריפרש` |
| `app_name` | App launcher name | `Refresh POS` |

**Production:** set `admin_dashboard_url` to your deployed dashboard (e.g. `https://refresh-dashboard.vercel.app/`).  
**Local dev:** temporarily set to `http://YOUR_MAC_IP:5173/` (e.g. `http://192.168.1.110:5173/`), run `npm run dev` in the dashboard with `host: '0.0.0.0'`.

Optional: add your logo for receipts — see `pos-print-sdk/ADD_YOUR_LOGO.md`.

---

## Step 1: Open the project in Android Studio

1. Open **Android Studio**.
2. **File → Open** (or “Open” on welcome screen).
3. Navigate to the **pos-print-sdk** folder of the dashboard you’re building, e.g.:
   - Luqma: `.../luqma/admin-dashboard/pos-print-sdk`
   - Refresh: `.../MenuAppTemplate/Clients/refresh/refresh-dashboard/pos-print-sdk`
   - Risto: `.../MenuAppTemplate/Clients/risto/risto-dashboard/pos-print-sdk`
4. Click **Open**. Wait for **Gradle sync** to finish (status bar at bottom).

If you see **“SDK location not found”**:

```bash
cd <path-to-pos-print-sdk>
echo "sdk.dir=$HOME/Library/Android/sdk" > local.properties
```

Then **File → Sync Project with Gradle Files**.

---

## Step 2: Build the APK

**In Android Studio:**

1. **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
2. Wait for the build (a few minutes).
3. When the notification appears, click **“locate”** to open the output folder.

**Output paths:**

- Debug: `poswebview/build/outputs/apk/debug/poswebview-debug.apk`
- Release: `poswebview/build/outputs/apk/release/poswebview-release.apk` (after signing; see Optional step below)

**From terminal (optional):**

```bash
cd <path-to-pos-print-sdk>
./gradlew assembleDebug
# APK: poswebview/build/outputs/apk/debug/poswebview-debug.apk
```

Use **debug** for quick install and test. Use **release** for production (requires signing).

---

## Step 3: Enable USB debugging on the H10

1. On the H10: **Settings → About device**.
2. Tap **Build number** 7 times. You’ll see “You are now a developer.”
3. Go back to **Settings → Developer options**.
4. Turn on **USB debugging**.
5. If present, turn on **Install via USB** (or similar).

---

## Step 4: Connect H10 to the Mac and install

1. Connect the H10 to the Mac with the **USB cable**.
2. On the H10, if prompted “Allow USB debugging?”, tap **Allow** (and optionally “Always from this computer”).
3. On the Mac, in a terminal:

```bash
# Check device is seen
adb devices
# You should see one device with status "device"

# Install the APK (replace path with your actual path)
adb install -r /path/to/poswebview/build/outputs/apk/debug/poswebview-debug.apk
```

Example for Refresh (run from Mac):

```bash
cd /Users/moody/Documents/Dev/MenuAppTemplate/Clients/refresh/refresh-dashboard/pos-print-sdk
adb install -r poswebview/build/outputs/apk/debug/poswebview-debug.apk
```

- **-r** = replace existing install (upgrade).
- If you get “no devices”, unplug/replug USB, confirm the “Allow USB debugging” dialog on the H10, and run `adb kill-server && adb devices`.

---

## Step 5: Run the app on the H10

1. On the H10, open the app (e.g. **“Refresh POS”** or **“Luqma POS”**).
2. The WebView will load the URL from `admin_dashboard_url` (your Vercel dashboard or local dev server).
3. You should see the dashboard and, if the printer is connected, a printer status bar (e.g. “طابعة H10 متصلة” or “طابعة SENRAISE متصلة”).
4. Use **“اختبار الطباعة” (Test print)** to confirm printing.

**If you use a local dev URL:**

- Mac and H10 must be on the **same Wi‑Fi**.
- On the Mac: `cd <dashboard> && npm run dev` (and in `vite.config.js` use `server: { host: '0.0.0.0', port: 5173 }`).
- In `strings.xml` set `admin_dashboard_url` to `http://<YOUR_MAC_IP>:5173/` (find IP in System Settings → Network or `ifconfig`).

---

## Optional: Signed release APK (production)

For a release build you must sign the APK.

**1. Create a keystore (once per project/brand):**

```bash
keytool -genkey -v -keystore refresh-pos.keystore -alias refresh -keyalg RSA -keysize 2048 -validity 10000
# Enter a password and store it safely.
```

**2. Configure signing in the app module**

Edit `pos-print-sdk/poswebview/build.gradle` and add inside `android { }`:

```groovy
signingConfigs {
    release {
        storeFile file("../../refresh-pos.keystore")   // or path relative to poswebview/
        storePassword "your-keystore-password"
        keyAlias "refresh"
        keyPassword "your-key-password"
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled false
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

Better: put passwords in `gradle.properties` (and add it to `.gitignore`) and reference them with `storePassword project.property('KEYSTORE_PASSWORD')`, etc.

**3. Build release:**

```bash
./gradlew assembleRelease
# Output: poswebview/build/outputs/apk/release/poswebview-release.apk
```

Then install with:

```bash
adb install -r poswebview/build/outputs/apk/release/poswebview-release.apk
```

---

## Troubleshooting

| Problem | What to do |
|--------|------------|
| **SDK location not found** | Create `local.properties` with `sdk.dir=$HOME/Library/Android/sdk` in `pos-print-sdk`. |
| **Java version / Unsupported class file** | Use JDK 11+: `export JAVA_HOME=$(/usr/libexec/java_home -v 11)`, then run Gradle again. |
| **adb: no devices** | Replug USB; allow USB debugging on H10; run `adb kill-server` then `adb devices`. |
| **Printer not connecting** | App uses SENRAISE printer service + Bluetooth. Check H10 Bluetooth is on; see `H10_POS_DEPLOYMENT_GUIDE.md` for port/charset and logs. |
| **Dashboard doesn’t load** | Confirm `admin_dashboard_url` in `strings.xml`. For local dev, use Mac’s LAN IP and `host: '0.0.0.0'` in Vite; allow firewall for port 5173. |
| **Gradle sync failed** | Ensure you opened the **pos-print-sdk** folder (not the whole repo). Check internet for dependencies. |

More detail: **H10_POS_DEPLOYMENT_GUIDE.md** and **pos-print-sdk/BUILD_INSTRUCTIONS.md**.

---

## Quick reference: paths per project

| Project | pos-print-sdk path (example) | Production dashboard URL |
|---------|-----------------------------|---------------------------|
| Luqma | `luqma/admin-dashboard/pos-print-sdk` | https://admin.luqma.co.il/ |
| Refresh | `MenuAppTemplate/Clients/refresh/refresh-dashboard/pos-print-sdk` | https://refresh-dashboard.vercel.app/ |
| Risto | `MenuAppTemplate/Clients/risto/risto-dashboard/pos-print-sdk` | https://risto-dashboard.vercel.app/ |
| Bunelo | `MenuAppTemplate/Clients/bunelo/bunelo-dashboard/pos-print-sdk` | https://bunelo-dashboard.vercel.app/ |
| Icon | `MenuAppTemplate/Clients/icon/icon-dashboard/pos-print-sdk` | https://app.icon-store.co.il/ (or your domain) |

---

## “Drop into chat” template for any new project

When starting POS for a new menu app, you can paste something like this into the chat:

```
Build the POS app for [PROJECT_NAME] from A to Z until I have the APK installed on my H10.

- Dashboard URL: https://[project]-dashboard.vercel.app/
- Brand: [Name] (English), [Arabic], [Hebrew if needed]
- Path: [path to this project's pos-print-sdk]

Use the guide in luqma/admin-dashboard/POS_BUILD_AND_INSTALL_A_TO_Z.md and the same steps we used for Luqma/Refresh.
```

Example for Refresh:

```
Build the POS app for Refresh from A to Z until I have the APK installed on my H10.
- Dashboard URL: https://refresh-dashboard.vercel.app/
- Brand: Refresh, ريفرش, ריפרש
- Path: MenuAppTemplate/Clients/refresh/refresh-dashboard/pos-print-sdk
Use the guide in luqma/admin-dashboard/POS_BUILD_AND_INSTALL_A_TO_Z.md.
```

---

**Related files in this repo**

- **H10_POS_DEPLOYMENT_GUIDE.md** — Deployment, network, printer config, kiosk mode.
- **pos-print-sdk/BUILD_INSTRUCTIONS.md** — Android Studio vs command-line build.
- **pos-print-sdk/QUICK_START.md** — Minimal steps to run.
- **pos-print-sdk/ADD_YOUR_LOGO.md** — Receipt logo.
- **pos-print-sdk/poswebview/.../MainActivity.java** — WebView URL from `strings.xml`, print bridge.
