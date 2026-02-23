# 🎨 How to Add Your Restaurant Logo to Receipts

## 📁 Step 1: Prepare Your Logo

**Requirements:**
- **Format:** PNG or JPG
- **Size:** 200-400px width recommended
- **Background:** Transparent PNG (best) or white background
- **Colors:** Black & white or grayscale works best for printing
- **File name:** `receipt_logo.png`

---

## 📂 Step 2: Add Logo to Project

**Copy your logo to:**
```
admin-dashboard/pos-print-sdk/poswebview/src/main/res/drawable/
```

**File should be named:** `receipt_logo.png`

**Full path:**
```
pos-print-sdk/poswebview/src/main/res/drawable/receipt_logo.png
```

---

## 🔧 Step 3: Rebuild APK

**In Android Studio:**
1. Build → Generate APKs
2. Wait for build
3. Install on H10

**Or command line:**
```bash
cd admin-dashboard/pos-print-sdk
./gradlew assembleDebug
adb install -r poswebview/build/outputs/apk/debug/poswebview-debug.apk
```

---

## 🖨️ Step 4: Test

**On H10:**
- Open POS Terminal app
- Click test print
- **Logo will appear at top of receipt!** 🎉

---

## 🎨 Logo Tips

### **Best Practices:**
- ✅ Simple, clean design (prints better)
- ✅ High contrast (black on white)
- ✅ Horizontal orientation (fits receipt width)
- ✅ No gradients (thermal printers are monochrome)
- ✅ Bold lines (thin lines might not print well)

### **Logo Dimensions:**
- Will auto-scale to fit 200px width maximum
- Maintains aspect ratio
- Centered on receipt

### **If No Logo:**
- App automatically uses text header instead
- Shows brand name in English + Arabic
- Still looks professional!

---

## 📋 For Each New Client

**When setting up for a new restaurant:**

1. **Get their logo** (PNG, black & white preferred)
2. **Rename to** `receipt_logo.png`
3. **Copy to** `res/drawable/`
4. **Update** `res/values/strings.xml`:
   ```xml
   <string name="brand_name">Restaurant Name</string>
   <string name="brand_name_ar">اسم المطعم</string>
   <string name="admin_dashboard_url">https://admin.restaurant.com/</string>
   ```
5. **Rebuild APK**
6. **Done!** ✅

---

## 🔍 Troubleshooting

**Logo not showing?**
- Check file is named exactly: `receipt_logo.png`
- Check file is in: `res/drawable/` folder
- Check logs: `adb logcat | grep POS`
  - Should see: "📷 Loading logo from resources"
  - If see: "ℹ️ No logo found" = file not in correct location

**Logo too big/small?**
- Logo auto-scales to 200px width max
- To change: Edit line in `MainActivity.java`:
  ```java
  int maxLogoWidth = 200; // Change this number
  ```

**Logo prints poorly?**
- Use simpler design
- Increase contrast
- Make lines bolder
- Avoid gradients

---

## ✨ Result

**With logo:**
```
    [YOUR LOGO IMAGE]
    
    ────────────────
    
    طلب رقم #123456
    ...receipt details...
```

**Without logo:**
```
        LUQMA
         لقمة
    ────────────────
    
    طلب رقم #123456
    ...receipt details...
```

Both look professional! 🎉

















