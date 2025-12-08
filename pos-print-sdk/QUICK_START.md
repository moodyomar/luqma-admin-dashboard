# 🚀 H10 POS Quick Start

## Fastest Way to Get Running:

### 1️⃣ Build the APK
```bash
cd /Users/moody/Documents/Dev/luqma/admin-dashboard/pos-print-sdk

# Option A: Using Android Studio
# - Open this folder in Android Studio
# - Build → Build APK(s)

# Option B: Command line (if you have Gradle)
./gradlew assembleDebug
```

### 2️⃣ Install on H10
```bash
# Enable USB debugging on H10 first (see main guide)
adb install -r poswebview/build/outputs/apk/debug/poswebview-debug.apk
```

### 3️⃣ Start Your Dev Server
```bash
cd /Users/moody/Documents/Dev/luqma/admin-dashboard
npm run dev
```

### 4️⃣ Launch App on H10
- Open "Luqma POS" app
- Should auto-load: `http://192.168.1.110:5173/`
- Look for purple "طابعة H10 متصلة" bar
- Click "اختبار الطباعة" to test

---

## 🐛 Quick Fixes

**Can't connect?**
- Check both devices on same WiFi
- Mac firewall allows port 5173

**No printer bar?**
- Printer library not loaded
- Check `/dev/ttyS1` or `/dev/ttyS0` in MainActivity.java

**Print fails?**
- Check ADB logs: `adb logcat | grep Luqma`
- Try different charset in MainActivity.java line 125

---

## ✅ What You Get

- **Silent Printing** - No browser dialogs
- **Touch-Optimized UI** - Large buttons for kitchen staff
- **Real-time Updates** - Orders appear instantly
- **Arabic Support** - RTL layout with Arabic text
- **Printer Status** - Visual indicator at top
- **Test Button** - Quick printer verification

---

**Full guide:** See `H10_POS_DEPLOYMENT_GUIDE.md`

**Code files:**
- Android App: `poswebview/src/main/java/com/luqma/pos/MainActivity.java`
- Web Print Logic: `../pages/OrdersPage.jsx` (line 278)
- POS Styles: `../pages/pos-terminal.css`



