# 🧪 Test Receipt Word Wrapping - Complete Guide

## ✅ What We Created

I've created a **local test preview tool** so you can test the word wrapping **before deploying anything**!

## 🚀 How to Test Locally

### Step 1: Open the Test Preview

Open this file in your browser:
```
admin-dashboard/pages/ReceiptTestPreview.html
```

You can open it directly:
- **Mac:** Right-click file → "Open With" → Chrome/Safari/Firefox
- **Or:** Drag the file into your browser window
- **Or:** Use `file://` URL: `file:///Users/moody/Documents/Dev/luqma/admin-dashboard/pages/ReceiptTestPreview.html`

### Step 2: Test with Real Data

The preview will automatically load with order #23ffbc data:
- Product: وجبة فطور (شخصي)
- Long extras: سلطة عربية + لبنة + عسل + زيتون + جبنة بيضاء + فلفل حار + صلصة خاصة

**You'll see:**
1. ✅ **Visual preview** - Exactly how it will look when printed (384px width)
2. ✅ **Raw text output** - The exact text sent to printer (line by line)
3. ✅ **Status info** - Shows if wrapping worked and how many lines

### Step 3: Test Different Scenarios

Try these tests:

1. **Short extras** (should fit on one line):
   ```
   دبس رمان
   ```

2. **Medium extras** (should wrap once):
   ```
   سلطة عربية + لبنة + عسل
   ```

3. **Long extras** (should wrap multiple times):
   ```
   سلطة عربية + لبنة + عسل + زيتون + جبنة بيضاء + فلفل حار + صلصة خاصة + جبنة فيتا
   ```

4. **Very long extras**:
   ```
   سلطة عربية + لبنة + عسل + زيتون + جبنة بيضاء + فلفل حار + صلصة خاصة + جبنة فيتا + طماطم + بصل + خيار
   ```

### Step 4: Verify the Output

**Check:**
- ✅ Extras wrap to multiple lines (not cropped)
- ✅ Each wrapped line starts with proper indentation (`   `)
- ✅ No text is cut off mid-word
- ✅ The visual preview shows all extras visible

**What to look for:**
```
✅ GOOD - Wrapped correctly:
   إضافات: سلطة عربية + لبنة + عسل
   + زيتون + جبنة بيضاء + فلفل حار
   + صلصة خاصة

❌ BAD - Still cropped:
   إضافات: سلطة عربية + لبنة + عسل وا...
```

---

## 🔍 Testing with Real Orders (After Preview Works)

Once the preview looks good:

### Option A: Test in Dev Server

1. **Start dev server**:
   ```bash
   cd admin-dashboard
   npm run dev
   ```

2. **Open browser console** (F12) to see wrapping logs

3. **Go to Orders page** and click Print on an order with long extras

4. **Check console** for:
   ```
   🔄 Wrapping text: ... Length: 65 Max: 32
   ✅ Wrapped into 3 lines: [...]
   ```

5. **Check receipt** - extras should wrap

### Option B: Test with Browser Print Preview

1. Click Print in Orders page
2. Browser print dialog opens
3. Preview shows wrapped text
4. Cancel print (don't actually print)

---

## 📊 What the Preview Shows

### 1. Visual Receipt (Left Side)
- Exact 384px width (58mm paper)
- Same font size and styling as printed receipt
- Shows how bitmap will look

### 2. Raw Text Output (Bottom)
- Exact text lines sent to printer
- Each line separated by `\n`
- Java code splits by `\n` and renders each line

### 3. Status Info (Right Panel)
- Shows if wrapping happened
- Shows how many lines
- Shows character count per line

---

## 🐛 Troubleshooting Preview

### Preview not showing correctly?

1. **Check browser console** (F12):
   - Look for JavaScript errors
   - Should see wrapping logs

2. **Verify extras are long enough**:
   - Need more than 35 characters to trigger wrapping
   - Check raw text output to see length

3. **Try different extras**:
   - Use the test scenarios above
   - Make sure extras are separated by ` + ` (space + space)

---

## ✅ When Preview Looks Good

Once you confirm the preview shows:
- ✅ Extras wrap correctly
- ✅ All text is visible (not cropped)
- ✅ Wrapping happens at good break points

**THEN** you can:
1. Test in dev server
2. Verify with real orders
3. Deploy to production

---

## 🎯 Quick Test Checklist

- [ ] Opened `ReceiptTestPreview.html` in browser
- [ ] Preview loaded with test data
- [ ] Extras wrap to multiple lines (visible, not cropped)
- [ ] Raw text output shows multiple lines
- [ ] Status shows wrapping happened
- [ ] Tried different long extras
- [ ] All extras visible in preview

---

**If preview works perfectly → Test in dev server → Then deploy!**
**If preview has issues → Fix wrapping function first!**


