# 📱 H10 POS Terminal App - Production Ready

**Status:** ✅ **WORKING** - Silent printing with Arabic support via bitmap rendering

---

## 🎯 What This Is

Android WebView app for **SENRAISE H10 Wireless Data Terminal** that:
- Loads your admin dashboard
- Connects to H10's InnerPrinter via Bluetooth
- Prints receipts **silently** (no dialogs)
- **Renders Arabic as images** (bypasses font limitations)

---

## ✅ Features

- ✅ **Silent Printing** - No confirmation dialogs
- ✅ **Arabic Support** - Bitmap rendering (Android renders, printer prints pixels)
- ✅ **Touch-Optimized UI** - Portrait mode, full-screen
- ✅ **Auto-Connect** - Finds and connects to InnerPrinter automatically
- ✅ **Bluetooth Permissions** - Requests at runtime (Android 12+)
- ✅ **Production Ready** - Configurable URL, generic code

---

## 📋 Configuration (Per Client)

### **File:** `poswebview/src/main/res/values/config.xml`

```xml
<!-- Admin Dashboard URL - CHANGE FOR EACH CLIENT -->
<string name="admin_dashboard_url">https://admin.yourclient.com/</string>

<!-- App Name - CHANGE FOR EACH CLIENT -->
<string name="app_name_pos">YourBrand POS</string>

<!-- Brand Colors -->
<color name="brand_primary">#2e7d32</color>
```

**That's it!** Just update these 3 values for each client.

---

## 🏗️ Building

### **For Testing (Debug APK):**
```bash
cd /path/to/pos-print-sdk
./gradlew assembleDebug
# Output: poswebview/build/outputs/apk/debug/poswebview-debug.apk
```

### **For Production (Release APK):**
```bash
# First time: Create keystore
keytool -genkey -v -keystore pos-release.keystore \
  -alias pos -keyalg RSA -keysize 2048 -validity 10000

# Build signed release
./gradlew assembleRelease
# Output: poswebview/build/outputs/apk/release/poswebview-release.apk
```

---

## 📱 Installation

```bash
# Enable USB debugging on H10 first
adb devices
adb install -r poswebview/build/outputs/apk/debug/poswebview-debug.apk
```

---

## 🖨️ How Printing Works

### **Arabic Text Solution:**

The H10's InnerPrinter doesn't have Arabic fonts in ROM. Our solution:

1. **Android renders text** (including Arabic) to Bitmap
2. **Convert Bitmap to monochrome image**
3. **Send pixels to printer** (not text!)
4. **Printer prints the image**

**Result:** ✅ Arabic appears perfectly on receipts!

### **Technical Details:**

- **Method:** `CP_Pos_PrintRasterImageFromData_Helper.PrintRasterImageFromBitmap()`
- **Codepage:** CP437 (standard, for English fallback)
- **Bitmap Size:** 384px width (58mm paper)
- **Line Height:** 32px per line
- **Font:** Android Default (supports all languages)

---

## 🔧 Troubleshooting

### **Printer Not Found:**
- Check Bluetooth is enabled on H10
- Verify "InnerPrinter" is paired in Bluetooth settings
- Check logs: `adb logcat | grep LuqmaPOS`

### **Blank Receipts:**
- **Check thermal paper!** Must be heat-sensitive
- Test: Scratch paper with fingernail - should turn black
- Use paper from other H10 terminals (confirmed working)

### **Network Connection:**
- Ensure H10 on same WiFi as server (for local testing)
- For production: Deploy dashboard to public URL first

---

## 📂 Project Structure

```
pos-print-sdk/
├── poswebview/
│   ├── src/main/
│   │   ├── java/com/luqma/pos/
│   │   │   └── MainActivity.java          ← Main app logic
│   │   ├── res/
│   │   │   ├── layout/activity_main.xml   ← WebView layout
│   │   │   ├── values/
│   │   │   │   ├── config.xml             ← CLIENT CONFIG HERE!
│   │   │   │   └── strings.xml
│   │   │   └── mipmap/                    ← App icons
│   │   └── AndroidManifest.xml            ← Permissions & config
│   ├── build.gradle                       ← Module build config
│   └── proguard-rules.pro
├── aar/
│   └── autoreplyprint.aar                 ← Printer library
├── build.gradle                           ← Root build config
├── settings.gradle
├── gradle.properties
└── README.md                              ← This file
```

---

## 🚀 Quick Start (New Client)

### **1. Update Config:**
Edit `poswebview/src/main/res/values/config.xml`:
```xml
<string name="admin_dashboard_url">https://admin.newclient.com/</string>
<string name="app_name_pos">NewClient POS</string>
```

### **2. Build APK:**
```bash
./gradlew assembleDebug
```

### **3. Install on H10:**
```bash
adb install -r poswebview/build/outputs/apk/debug/poswebview-debug.apk
```

### **4. Done!**
App loads client's dashboard and prints with Arabic support!

---

## 📊 Tested & Working

- ✅ **Device:** SENRAISE H10 (Android 14, H10P-OS01 14.0.207)
- ✅ **Printer:** InnerPrinter (Bluetooth 00:11:22:33:44:55)
- ✅ **Paper:** Thermal paper (heat-sensitive)
- ✅ **Languages:** English ✅, Arabic ✅ (via bitmap), Hebrew ✅ (via bitmap)
- ✅ **Print Speed:** ~2-3 seconds
- ✅ **Silent:** No dialogs or confirmations

---

## 📝 Notes

### **Why Bitmap Printing?**

The H10's thermal printer ROM doesn't include Arabic/Hebrew fonts. Standard codepages (CP864, CP720, Windows-1256) all failed.

**Solution:** Render text as image using Android's text engine (which supports all languages), then print the pixels.

**Trade-offs:**
- ✅ Works with ANY language
- ✅ Perfect rendering
- ⚠️ Slightly slower (~1-2 seconds extra)
- ⚠️ Larger data transfer

### **Alternative:**

If you need faster printing or have a different POS terminal, consider:
- External Bluetooth printer with Arabic font support
- Different terminal model with Arabic ROM
- Text-only English receipts (instant)

---

## 🔗 Related Documentation

- `H10_POS_DEPLOYMENT_GUIDE.md` - Detailed setup instructions
- `H10_SETUP_SUMMARY.md` - Quick overview
- `H10_PRINTING_STATUS.md` - Technical details about printing
- `QUICK_START.md` - Fast reference
- `TESTING_CHECKLIST.md` - Complete testing guide

---

**Built for white-label restaurant POS systems** 🍽️

Tested December 4, 2025 with SENRAISE H10 Wireless Data Terminal

