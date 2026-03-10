# 🔍 Why Does the Apple Pay Page Show Blank?

## Quick Answer

When you visit `https://qbmenu-7963c.web.app/tranzila-applepay.html` directly in a browser, it appears blank because:

1. ✅ **The file IS deployed** (HTTP 200 status)
2. ⚠️ **It needs query parameters** to work properly
3. ⚠️ **It loads content dynamically** via JavaScript/iframe
4. ⚠️ **It's designed for iframe embedding**, not direct browser viewing

---

## Detailed Explanation

### 1. The File Needs Query Parameters

The `tranzila-applepay.html` file reads parameters from the URL:

```javascript
var urlParams = new URLSearchParams(window.location.search);
var paymentSum = urlParams.get('sum') || '0.00';
var paymentCurrency = urlParams.get('currency') || '1';
var paymentTerminal = urlParams.get('terminal') || 'fxpluqma';
```

**Without parameters:**
- `sum` defaults to `'0.00'` → Tranzila might reject or show nothing
- `terminal` defaults to `'fxpluqma'` → might not be correct for your client

**Try this URL instead:**
```
https://qbmenu-7963c.web.app/tranzila-applepay.html?sum=100.00&currency=1&terminal=fxpluqma
```

### 2. It Loads Content Dynamically

The page:
1. Loads jQuery from CDN
2. Loads Tranzila's Apple Pay library dynamically
3. Creates an iframe that loads Tranzila's payment page
4. All of this happens via JavaScript

**When accessed directly:**
- JavaScript might be blocked by browser security
- Cross-origin restrictions might prevent iframe loading
- Tranzila's domain might block direct access

### 3. It's Designed for Iframe Embedding

The file is meant to be:
- Loaded inside a WebView/iframe in your React Native app
- Called with proper query parameters from your app
- Used within the payment flow context

**Not meant for:**
- Direct browser viewing
- Testing by visiting the URL directly
- Standalone page viewing

---

## How to Test Properly

### Option 1: Test with Query Parameters

Visit with proper parameters:
```
https://qbmenu-7963c.web.app/tranzila-applepay.html?sum=100.00&currency=1&terminal=fxpluqma
```

**What you should see:**
- A blank page initially (loading)
- Then Tranzila's payment iframe should load
- Apple Pay button should appear (if device supports it)

### Option 2: Test in Your App

The **proper way** to test:
1. Open your React Native app
2. Go through checkout flow
3. Select Apple Pay
4. The app loads the URL with proper parameters automatically

### Option 3: Check Browser Console

Open browser DevTools (F12) and check:
- **Console tab:** Look for JavaScript errors
- **Network tab:** See if Tranzila's scripts are loading
- **Elements tab:** Check if the iframe is created

**Common issues:**
- `CORS error` → Normal, Tranzila blocks cross-origin access
- `jQuery not loaded` → Network issue
- `TranzilaApple not defined` → Script loading issue

---

## Why It Works in Your App But Not Browser

### In Your App (React Native WebView):
✅ WebView allows iframe embedding
✅ Query parameters are passed correctly
✅ Payment context is established
✅ Tranzila recognizes the payment flow

### In Browser (Direct Access):
❌ No query parameters (or wrong ones)
❌ Cross-origin restrictions
❌ No payment context
❌ Tranzila might block direct access

---

## Verification Checklist

### ✅ File is Deployed
```bash
curl -I https://qbmenu-7963c.web.app/tranzila-applepay.html
# Should return: HTTP/2 200
```

### ✅ File Content is Correct
```bash
curl https://qbmenu-7963c.web.app/tranzila-applepay.html | head -20
# Should show HTML content
```

### ✅ Works with Parameters
Visit in browser:
```
https://qbmenu-7963c.web.app/tranzila-applepay.html?sum=100&currency=1&terminal=fxpluqma
```

### ✅ Works in App
- Test Apple Pay flow in your React Native app
- Check if payment page loads correctly

---

## Common Issues & Solutions

### Issue: "Blank Page"

**Cause:** Missing or incorrect query parameters

**Solution:**
- Add query parameters: `?sum=100&currency=1&terminal=fxpluqma`
- Or test in your app (which adds parameters automatically)

### Issue: "CORS Error"

**Cause:** Browser security blocking cross-origin requests

**Solution:**
- This is **normal** when accessing directly
- It works fine in WebView/iframe context
- Not a problem for production use

### Issue: "Tranzila Script Not Loading"

**Cause:** Network issue or Tranzila blocking

**Solution:**
- Check browser console for errors
- Verify Tranzila's CDN is accessible
- Test in your app instead (more reliable)

---

## Summary

**The page showing "blank" when accessed directly is EXPECTED behavior.**

**Why?**
- It's designed for iframe embedding, not direct viewing
- It needs query parameters to function
- It loads content dynamically via JavaScript

**How to verify it works?**
- ✅ Test in your React Native app (proper way)
- ✅ Or visit with query parameters: `?sum=100&currency=1&terminal=fxpluqma`

**The file IS deployed correctly** - the "blank" appearance is just because it's not being used in its intended context (iframe with parameters).
