# 🎨 Quick Logo Setup (No Dependencies Needed!)

## Option 1: Using macOS Preview (EASIEST) ⭐

### Step 1: Save the Logo
1. Right-click the logo image in chat
2. "Save Image As..." → Save to Desktop as `luqma_logo.png`

### Step 2: Optimize with Preview
1. **Open** `luqma_logo.png` in **Preview** (double-click)
2. **Tools → Adjust Size...**
   - Width: `200` pixels
   - ✅ Check "Scale proportionally"
   - Click **OK**
3. **File → Export...**
   - Format: **PNG**
   - ✅ Check "Alpha" (transparency)
   - Save as: `receipt_logo.png`
4. **Copy to project:**
   ```bash
   cp ~/Desktop/receipt_logo.png /Users/moody/Documents/Dev/luqma/admin-dashboard/pos-print-sdk/poswebview/src/main/res/drawable/receipt_logo.png
   ```

### Step 3: Rebuild & Test
- Android Studio: Build → Generate APKs
- Install on H10
- Logo appears on receipts! ✨

---

## Option 2: Use Online Tool (NO SOFTWARE NEEDED)

### Step 1: Go to https://www.iloveimg.com/resize-image
1. Upload your logo
2. Resize to **200px width**
3. Download result

### Step 2: Convert to Grayscale (Optional but Recommended)
1. Go to: https://www.iloveimg.com/convert-to-jpg
2. Upload resized logo
3. Click "Options" → Convert to **Grayscale**
4. Download

### Step 3: Add to Project
```bash
cp ~/Downloads/receipt_logo.png /Users/moody/Documents/Dev/luqma/admin-dashboard/pos-print-sdk/poswebview/src/main/res/drawable/receipt_logo.png
```

---

## Option 3: Skip Image Processing (Use As-Is)

### Just Copy the Logo:
```bash
# Save logo from chat to Desktop first
# Then:
cp ~/Desktop/luqma_logo.png /Users/moody/Documents/Dev/luqma/admin-dashboard/pos-print-sdk/poswebview/src/main/res/drawable/receipt_logo.png
```

**Android will resize it automatically!**

---

## ✅ Verify Logo is Added:

```bash
ls -lh /Users/moody/Documents/Dev/luqma/admin-dashboard/pos-print-sdk/poswebview/src/main/res/drawable/receipt_logo.png
```

Should show the file!

---

## 🚀 Then Rebuild:

**Android Studio:** Build → Generate APKs

**Install:**
```bash
adb install -r poswebview/build/outputs/apk/debug/poswebview-debug.apk
```

**Test:** Logo will appear at top of receipts!

---

## 💡 Quick M1 Mac Command:

**If you just want to copy the logo as-is:**

```bash
# 1. Save logo image from chat to Desktop
# 2. Run this command:
cp ~/Desktop/luqma_logo.png /Users/moody/Documents/Dev/luqma/admin-dashboard/pos-print-sdk/poswebview/src/main/res/drawable/receipt_logo.png && echo "✅ Logo added! Now rebuild in Android Studio"
```

Done! 🎉











