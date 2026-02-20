# 🧪 H10 POS Testing Checklist

Use this checklist when testing your POS terminal setup.

---

## 📋 Pre-Installation Tests

### Environment Check
- [ ] Mac and H10 on same WiFi network
- [ ] Mac firewall allows port 5173
- [ ] H10 has developer mode enabled
- [ ] USB debugging enabled on H10
- [ ] ADB recognizes H10 (`adb devices`)

### Build Check
- [ ] Android Studio installed (or Gradle working)
- [ ] APK builds without errors
- [ ] APK file exists in `poswebview/build/outputs/apk/debug/`
- [ ] APK size reasonable (5-10 MB expected)

---

## 📱 Installation Tests

### App Installation
- [ ] APK installs via ADB: `adb install -r poswebview-debug.apk`
- [ ] "Luqma POS" icon appears in app drawer
- [ ] App launches without crashing
- [ ] Permissions granted (if prompted)

---

## 🌐 Network Tests

### Dev Server
- [ ] Vite dev server running: `npm run dev`
- [ ] Shows network URL: `http://192.168.1.110:5173/`
- [ ] Can open URL in Mac browser
- [ ] Admin dashboard loads correctly

### H10 Connection
- [ ] H10 browser can access: `http://192.168.1.110:5173/`
- [ ] Luqma POS app loads dashboard automatically
- [ ] No "connection refused" errors
- [ ] Page renders correctly (not blank)

---

## 🖨️ Printer Tests

### Printer Status
- [ ] Purple status bar visible at top
- [ ] Shows "طابعة H10 متصلة ✅" (connected)
- [ ] If not connected, shows "فحص الطابعة..." (checking)
- [ ] Device name shows "H10 Wireless Terminal"

### Test Print
- [ ] "اختبار الطباعة" button visible
- [ ] Click button - no errors
- [ ] Thermal printer activates
- [ ] Test receipt prints completely
- [ ] Text is readable (not garbage)
- [ ] Arabic text shows correctly
- [ ] Paper cuts at end
- [ ] Toast shows: "✅ تمت الطباعة بنجاح"

### Expected Test Receipt:
```
════════════════════════
اختبار الطباعة
Test Print
════════════════════════

Device: H10 Terminal
App: Luqma POS

✅ الطابعة تعمل بشكل صحيح
✅ Printer working correctly

════════════════════════
```

---

## 📄 Order Print Tests

### Order Display
- [ ] Orders load from Firebase
- [ ] Order cards display correctly
- [ ] 🖨️ print button visible on each order
- [ ] Button is large enough (56px min)
- [ ] Button changes on touch/hover

### Print Order Receipt
- [ ] Click 🖨️ on an order
- [ ] No browser print dialog appears
- [ ] Printer starts immediately
- [ ] Receipt prints completely

### Receipt Content Check
- [ ] Order number (6 chars)
- [ ] Customer name
- [ ] Customer phone
- [ ] Delivery method (توصيل/استلام/أكل بالمطعم)
- [ ] Address (if delivery)
- [ ] Table number (if eat-in)
- [ ] Payment method (كاش/اونلاين)
- [ ] Item count
- [ ] Total price
- [ ] All items listed with:
  - [ ] Item name (in Arabic)
  - [ ] Quantity
  - [ ] Options/size
  - [ ] Extras (if any)
  - [ ] Item note (if any)
- [ ] Customer note (if any)
- [ ] Final total
- [ ] "شكراً لاستخدامكم تطبيق لقمة"
- [ ] Paper cuts at end

### Print Quality
- [ ] Text is clear and readable
- [ ] No weird characters (�, ?, boxes)
- [ ] Arabic displays right-to-left
- [ ] Numbers display correctly
- [ ] Spacing is good (not too cramped)
- [ ] Lines are straight
- [ ] Paper doesn't jam

---

## 🎨 UI Tests

### Display
- [ ] Landscape orientation
- [ ] Full screen (no address bar)
- [ ] High contrast - readable in kitchen
- [ ] Text large enough to read (16px+)
- [ ] Buttons large enough to tap (56px+)

### Touch Interaction
- [ ] Buttons respond to touch
- [ ] No accidental double-taps
- [ ] Scroll works smoothly
- [ ] Filter buttons work
- [ ] Order actions work (Accept, Ready, etc.)

### Status Indicators
- [ ] Order badges show correct colors
- [ ] Pending orders highlighted
- [ ] Timer displays (if preparing)
- [ ] Future orders badge (if any)

---

## 🔄 Realtime Tests

### Order Updates
- [ ] New orders appear automatically
- [ ] Audio alert plays (if enabled)
- [ ] Order count updates
- [ ] Status changes reflect immediately
- [ ] No need to refresh manually

---

## ⚡ Performance Tests

### Speed
- [ ] App launches in < 3 seconds
- [ ] Dashboard loads in < 2 seconds
- [ ] Print starts in < 1 second
- [ ] No lag when scrolling
- [ ] Orders load smoothly

### Stability
- [ ] No crashes after 10 minutes
- [ ] No crashes after printing 10 receipts
- [ ] Memory usage stable
- [ ] WiFi reconnects if dropped

---

## 🐛 Error Handling Tests

### Network Issues
- [ ] Shows error if Mac server stops
- [ ] Handles WiFi disconnect gracefully
- [ ] Reconnects when WiFi returns

### Printer Issues
- [ ] Shows error if printer disconnected
- [ ] Toast explains error clearly
- [ ] Doesn't crash if print fails
- [ ] Can retry print after error

### Edge Cases
- [ ] Handles empty orders list
- [ ] Handles very long customer notes
- [ ] Handles orders with many items (10+)
- [ ] Handles special characters in names
- [ ] Handles missing/null data gracefully

---

## 🔐 Security Tests

### Permissions
- [ ] Only necessary permissions requested
- [ ] No location access (not needed)
- [ ] No camera access (not needed)
- [ ] Internet access works
- [ ] Storage access works (if needed)

---

## 🎯 Production Readiness

### Before Go-Live
- [ ] All tests above pass ✅
- [ ] Staff trained on using POS
- [ ] Backup H10 device available
- [ ] Extra thermal paper rolls stocked
- [ ] Contact info for troubleshooting
- [ ] Production URL configured (not localhost)
- [ ] Release APK signed (not debug)

---

## 📊 Acceptance Criteria

### Must Have (Critical)
- [ ] ✅ Silent printing works (no dialogs)
- [ ] ✅ Prints complete receipts
- [ ] ✅ Arabic text displays correctly
- [ ] ✅ Orders update in realtime
- [ ] ✅ No crashes during use

### Should Have (Important)
- [ ] ✅ Print under 2 seconds
- [ ] ✅ Clear error messages
- [ ] ✅ Large touch-friendly UI
- [ ] ✅ Printer status visible
- [ ] ✅ Test print button works

### Nice to Have (Optional)
- [ ] Auto-print on order accept
- [ ] Kiosk mode enabled
- [ ] Custom branding
- [ ] Multiple printer support

---

## 📝 Test Report Template

**Date:** _______________  
**Tester:** _______________  
**Device:** H10 Wireless Data Terminal  
**APK Version:** _______________  

### Test Results:
- Installation: ⬜ Pass ⬜ Fail
- Network: ⬜ Pass ⬜ Fail  
- Printer: ⬜ Pass ⬜ Fail
- Print Quality: ⬜ Pass ⬜ Fail
- UI/UX: ⬜ Pass ⬜ Fail
- Performance: ⬜ Pass ⬜ Fail

### Issues Found:
1. _________________________________
2. _________________________________
3. _________________________________

### Overall Status:
⬜ Ready for Production  
⬜ Needs Fixes  
⬜ Major Issues  

**Notes:**  
_________________________________
_________________________________
_________________________________

---

## 🆘 Quick Troubleshooting

| Issue | Check | Fix |
|-------|-------|-----|
| No status bar | Console errors | Rebuild APK |
| Print fails | ADB logs | Change port |
| Garbage text | Encoding | Change charset |
| Network fail | Same WiFi | Fix firewall |
| App crash | Logcat | Check permissions |

**View logs:**
```bash
adb logcat | grep -E "Luqma|printer|error"
```

---

**After all tests pass, you're ready for production! 🎉**


















