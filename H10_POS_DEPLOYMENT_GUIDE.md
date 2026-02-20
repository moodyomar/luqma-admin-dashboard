# H10 POS Terminal Deployment Guide

**Device:** H10 Wireless Data Terminal  
**Android Version:** 14 (H10P-OS01 14.0.207)  
**Purpose:** Silent printing for Luqma Admin Dashboard

---

## 📋 Overview

This guide will help you deploy the Luqma POS app to your H10 terminal for **silent, seamless receipt printing** without browser prompts.

### What We Built:
1. ✅ **Android WebView App** - Loads your admin dashboard at `http://192.168.1.110:5173/`
2. ✅ **JavaScript Bridge** - Exposes `window.PosPrinter` for silent printing
3. ✅ **POS-Optimized UI** - Touch-friendly, large buttons, high contrast
4. ✅ **Native Printer Integration** - Direct thermal printer control

---

## 🛠️ Step 1: Build the Android APK

### Prerequisites:
- Android Studio (Arctic Fox or newer)
- JDK 11 or newer
- Android SDK (API 34)

### Build Steps:

```bash
# Navigate to the POS SDK directory
cd /Users/moody/Documents/Dev/luqma/admin-dashboard/pos-print-sdk

# Open in Android Studio
# Or build from command line:

# For debug build (testing):
./gradlew assembleDebug

# For release build (production):
./gradlew assembleRelease

# Output APK locations:
# Debug: poswebview/build/outputs/apk/debug/poswebview-debug.apk
# Release: poswebview/build/outputs/apk/release/poswebview-release.apk
```

---

## 📱 Step 2: Install on H10 Terminal

### Method 1: USB Installation (Recommended)

1. **Enable Developer Mode on H10:**
   - Go to **Settings → About Device**
   - Tap **Build Number** 7 times
   - Developer Options will appear

2. **Enable USB Debugging:**
   - Go to **Settings → Developer Options**
   - Enable **USB Debugging**
   - Enable **Install via USB**

3. **Connect H10 to Computer:**
   ```bash
   # Check if device is connected
   adb devices
   
   # You should see:
   # List of devices attached
   # ABC123456789    device
   
   # Install the APK
   adb install -r poswebview/build/outputs/apk/debug/poswebview-debug.apk
   ```

### Method 2: Network Installation (Wireless)

1. **Upload APK to your server:**
   ```bash
   # Upload to a web server
   scp poswebview-debug.apk user@yourserver.com:/var/www/html/
   ```

2. **Download on H10:**
   - Open browser on H10
   - Navigate to: `http://yourserver.com/poswebview-debug.apk`
   - Tap to download
   - Open Downloads, tap APK
   - Allow "Install from Unknown Sources" if prompted
   - Tap **Install**

### Method 3: USB Drive

1. Copy APK to USB drive
2. Plug USB drive into H10 (if supported)
3. Use file manager to open APK
4. Tap **Install**

---

## 🌐 Step 3: Network Configuration

### Ensure H10 is on Same Network:

1. **Check H10 IP Address:**
   - Go to **Settings → Network → Wi-Fi**
   - Tap connected network
   - Note the IP address (e.g., `192.168.1.xxx`)

2. **Verify Admin Dashboard Server:**
   ```bash
   # On your Mac, ensure dev server is running:
   cd /Users/moody/Documents/Dev/luqma/admin-dashboard
   npm run dev
   
   # Should show:
   # ➜  Local:   http://localhost:5173/
   # ➜  Network: http://192.168.1.110:5173/
   ```

3. **Test Connection from H10:**
   - Open browser on H10
   - Navigate to: `http://192.168.1.110:5173/`
   - You should see the admin dashboard

### Important Network Notes:
- ⚠️ **Both devices MUST be on same Wi-Fi network**
- ⚠️ **Mac firewall should allow incoming connections on port 5173**
- ⚠️ If connection fails, check Mac firewall settings

---

## 🖨️ Step 4: Configure Printer

### Automatic Printer Detection:

The app tries these printer ports in order:
1. `/dev/ttyS1` (most common for H10)
2. `/dev/ttyS0` (fallback)

### Manual Configuration (if needed):

If printer doesn't work, you may need to find the correct port:

1. **Connect via ADB:**
   ```bash
   adb shell
   
   # List available serial ports
   ls -la /dev/tty*
   
   # Common ports for thermal printers:
   # /dev/ttyS0, /dev/ttyS1, /dev/ttyS2
   # /dev/ttyUSB0 (if USB printer)
   ```

2. **Update MainActivity.java** (line 91):
   ```java
   // Change from:
   int result = printer.Open("/dev/ttyS1", 115200, 0);
   
   // To your port:
   int result = printer.Open("/dev/ttyS0", 115200, 0);
   ```

3. **Rebuild and reinstall APK**

---

## ✅ Step 5: Testing

### Launch the App:

1. **Open Luqma POS app** on H10
2. Wait for dashboard to load
3. Look for the **purple printer status bar** at the top:
   - ✅ **"طابعة H10 متصلة"** = Printer ready!
   - ⚠️ **"فحص الطابعة..."** = Checking printer

### Test Print:

1. **Click "اختبار الطباعة" (Test Print)** button in purple bar
2. Printer should print a test receipt immediately
3. You should see toast: **"✅ تمت الطباعة بنجاح"**

### Print Real Order:

1. Navigate to an order
2. Click the **🖨️ button** on the order card
3. Receipt should print **silently without any dialog**
4. Toast notification will confirm: **"✅ تمت الطباعة بنجاح"**

---

## 🐛 Troubleshooting

### Issue: No printer status bar visible

**Solution:**
- The purple bar only shows if `window.PosPrinter` is available
- Open browser console (Chrome DevTools via USB debugging):
  ```bash
  adb forward tcp:9222 localabstract:chrome_devtools_remote
  # Open Chrome on Mac: chrome://inspect
  ```
- Check console for errors

### Issue: "فشل الاتصال بالطابعة" (Printer connection failed)

**Possible causes:**
1. **Wrong serial port** - Try different port (see Step 4)
2. **Printer library not loaded** - Check if `autoreplyprint.aar` is in `aar/` folder
3. **Permissions** - Add printer permissions to AndroidManifest.xml

**Fix permissions:**
```xml
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
```

### Issue: Prints garbage characters

**Solution:**
- Arabic charset issue
- Update `MainActivity.java` line 125:
  ```java
  printer.SetCharacterCodepage(22); // Try: 22 (CP864), 27 (CP720), or 15 (CP862)
  ```

### Issue: App crashes on print

**Check logs:**
```bash
adb logcat | grep -i "luqma\|printer\|error"
```

Common fixes:
- Ensure printer is initialized before printing
- Check that `autoreplyprint.aar` library is compatible with H10
- Verify Android permissions

### Issue: Network connection fails

**Solutions:**
1. **Check firewall on Mac:**
   ```bash
   # Allow port 5173
   # System Preferences → Security & Privacy → Firewall → Firewall Options
   # Allow incoming connections for Node/terminal
   ```

2. **Use IP instead of localhost:**
   - In `vite.config.js`, ensure:
   ```js
   server: {
     host: '0.0.0.0', // Listen on all interfaces
     port: 5173
   }
   ```

3. **Test connection:**
   ```bash
   # On H10 (via adb shell):
   ping 192.168.1.110
   curl http://192.168.1.110:5173/
   ```

---

## 📝 Production Deployment

### For Production Use:

1. **Change URL in MainActivity.java:**
   ```java
   // From:
   private static final String ADMIN_URL = "http://192.168.1.110:5173/";
   
   // To:
   private static final String ADMIN_URL = "https://your-admin-domain.com/";
   ```

2. **Build signed release APK:**
   ```bash
   # Create keystore (first time only):
   keytool -genkey -v -keystore luqma-pos.keystore -alias luqma -keyalg RSA -keysize 2048 -validity 10000
   
   # Add to gradle.properties:
   KEYSTORE_FILE=luqma-pos.keystore
   KEYSTORE_PASSWORD=your_password
   KEY_ALIAS=luqma
   KEY_PASSWORD=your_password
   
   # Build release:
   ./gradlew assembleRelease
   ```

3. **Deploy to hosted server:**
   - Use Vercel/Netlify for admin dashboard
   - Update URL in app
   - Reinstall on H10

---

## 🎨 UI Customization

### Adjust for Your Brand:

Edit `/admin-dashboard/pages/pos-terminal.css`:

```css
:root {
  --primary-color: #2e7d32;  /* Your brand color */
  --danger-color: #d32f2f;
  --success-color: #388e3c;
  /* ... */
}
```

### Change Print Layout:

Edit `/admin-dashboard/pages/OrdersPage.jsx` → `buildReceiptText()` function

---

## 📊 Performance Tips

1. **Auto-refresh orders:**
   - Uses Firebase realtime listeners
   - No need to refresh manually

2. **Keep screen on:**
   - Add to AndroidManifest.xml:
   ```xml
   <activity android:keepScreenOn="true" />
   ```

3. **Auto-print on order accept:**
   - Can be enabled in OrdersPage.jsx
   - Add `handlePrint(order)` to `handleAcceptOrder()`

---

## 🔧 Advanced Configuration

### Auto-Launch on Boot:

Add to AndroidManifest.xml:
```xml
<receiver android:name=".BootReceiver" android:enabled="true" android:exported="true">
  <intent-filter>
    <action android:name="android.intent.action.BOOT_COMPLETED"/>
  </intent-filter>
</receiver>
```

### Kiosk Mode (Lock to App):

```bash
# Via ADB:
adb shell dpm set-device-owner com.luqma.pos/.DeviceAdminReceiver
```

---

## 📞 Support

### Getting Help:

1. **Check logs:**
   ```bash
   adb logcat -s LuqmaPOS
   ```

2. **Test printer manually:**
   - Use H10's built-in printer test utility
   - Verify hardware works

3. **Web console:**
   - Open Chrome remote debugging
   - Check JavaScript errors

---

## 🎉 Success Checklist

- [ ] APK built successfully
- [ ] APK installed on H10
- [ ] H10 connected to same network as Mac
- [ ] Admin dashboard loads in browser
- [ ] Purple printer status bar shows "متصلة"
- [ ] Test print works
- [ ] Order print works silently
- [ ] No browser prompts on print
- [ ] Orders update in realtime

---

## 🚀 Next Steps

Once everything works:

1. **Train staff** on using the POS terminal
2. **Set up production** hosting for admin dashboard
3. **Configure auto-print** on order acceptance (optional)
4. **Enable kiosk mode** to lock device to app (optional)
5. **Monitor** printer paper and connectivity

---

## 📁 Project Structure Reference

```
admin-dashboard/
├── pos-print-sdk/
│   ├── poswebview/
│   │   ├── src/main/
│   │   │   ├── java/com/luqma/pos/MainActivity.java   ← Main app logic
│   │   │   ├── res/layout/activity_main.xml            ← UI layout
│   │   │   └── AndroidManifest.xml                     ← App config
│   │   └── build.gradle                                ← Build config
│   ├── aar/autoreplyprint.aar                          ← Printer library
│   ├── build.gradle                                    ← Root build
│   └── settings.gradle
├── pages/
│   ├── OrdersPage.jsx                                  ← Main orders UI
│   ├── pos-terminal.css                                ← POS styles
│   └── styles.css
└── H10_POS_DEPLOYMENT_GUIDE.md                         ← This file
```

---

**Built with ❤️ for Luqma**

For issues or questions, check the troubleshooting section or review the code comments in `MainActivity.java` and `OrdersPage.jsx`.


















