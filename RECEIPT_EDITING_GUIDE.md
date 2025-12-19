# 🧾 Receipt Editing Guide

## Visual Preview

**Open the visual preview to see exactly how the receipt looks:**
```
admin-dashboard/RECEIPT_VISUAL_PREVIEW.html
```

## 📋 Receipt Structure

The printed receipt is a **384px wide bitmap image** (58mm thermal paper) with the following structure:

```
┌─────────────────────────────────────┐
│         [LOGO - 150px max]          │
│         (centered, 80px space)      │
├─────────────────────────────────────┤
│          === Separator ===          │
│                                     │
│    طلب رقم #188a53                 │
│    11.11.2025, 22:35:55            │
│    --- --- --- --- --- ---         │
│                                     │
│    --- معلومات العميل ---          │
│    الاسم: عطاف شهاب                │
│    الهاتف: 972524733405            │
│    --- --- --- --- --- ---         │
│                                     │
│    --- تفاصيل التوصيل ---          │
│    نوع الطلب: استلام من المطعم     │
│    طريقة الدفع: نقداً (كاش)        │
│    --- --- --- --- --- ---         │
│                                     │
│    --- تفاصيل المنتجات ---         │
│                                     │
│    1. سلطة الجزر (M)               │
│       الكمية: 1 × ₪48.00           │
│       إضافات: دبس رمان             │
│                                     │
├─────────────────────────────────────┤
│                                     │
│    ╔═══════════════════════════╗   │
│    ║  المبلغ الإجمالي: ₪48.00 ║   │
│    ╚═══════════════════════════╝   │
│                                     │
├─────────────────────────────────────┤
│                                     │
│    Thank you for using Luqma        │
│    شكراً لاستخدامكم تطبيق لقمة      │
│                                     │
└─────────────────────────────────────┘
```

## 🔧 Editing Receipt Content

### Location 1: Text Content (`buildReceiptText`)

**File:** `admin-dashboard/pages/OrdersPage.jsx`  
**Function:** `buildReceiptText()` (lines 204-292)

This function generates the **text lines** that make up the receipt. Each line is added to the `lines` array:

```javascript
const buildReceiptText = (order) => {
  const lines = [];
  
  // Add your lines here:
  lines.push('================================'); // Thick separator
  lines.push('--- عنوان القسم ---');            // Section header
  lines.push('نص عادي');                        // Regular text
  lines.push('- - - - - - - - - - - - - - -'); // Dashed separator
  lines.push('');                                // Empty line (12px spacing)
  
  return lines.join('\n');
};
```

### Examples:

**Add a thank you message:**
```javascript
lines.push('شكراً لزيارتكم!');
lines.push('نتمنى لكم وجبة شهية');
```

**Add signature line:**
```javascript
lines.push('');
lines.push('التوقيع: _____________');
```

**Add custom section:**
```javascript
lines.push('--- ملاحظات إضافية ---');
lines.push('تأكد من تسجيل الطلب');
lines.push('- - - - - - - - - - - - - - - -');
```

## 🎨 Editing Receipt Styling

### Location 2: Visual Styling (`createTextBitmap`)

**File:** `admin-dashboard/pos-print-sdk/poswebview/src/main/java/com/luqma/pos/MainActivity.java`  
**Method:** `createTextBitmap()` (lines 270-464)

This method converts text lines into a **bitmap image** with styling.

### Key Styling Variables:

```java
int width = 384;        // Receipt width (58mm paper = 384px)
int lineHeight = 32;    // Space between lines
int padding = 15;       // Padding on all sides
```

### Font Sizes:

```java
// Regular text
textPaint.setTextSize(22);           // Default: 22px

// Section headers  
headerTextPaint.setTextSize(25);     // Default: 25px

// Total box text
totalPaint.setTextSize(26);          // Default: 26px
```

### Changing Colors:

```java
// Text color
textPaint.setColor(Color.BLACK);     // Black text

// Total box background
bgPaint.setColor(Color.rgb(245, 245, 245)); // Light gray

// Border color
borderPaint.setColor(Color.BLACK);   // Black border
```

### Example: Make total box more prominent

```java
// In createTextBitmap(), find the total box section (around line 424):

// Change background to darker gray
bgPaint.setColor(Color.rgb(230, 230, 230)); 

// Thicker border
borderPaint.setStrokeWidth(4);  // Default: 3

// Larger text
totalPaint.setTextSize(28);     // Default: 26
```

## 📝 Special Formatting Rules

The Java code automatically detects special patterns in text lines:

| Pattern | Result |
|---------|--------|
| `===` at start | Renders as thick solid line (2px) |
| `---` or `- - -` at start | Renders as thin dashed line (1px) |
| Contains `المبلغ الإجمالي` | Renders in bordered box with gray background |
| Contains `معلومات` or `تفاصيل` | Renders as larger section header (25px) |
| Empty line | Renders as 12px spacing |

### Examples:

```javascript
lines.push('================================');     // → Thick line
lines.push('- - - - - - - - - - - - - - - -');     // → Dashed line
lines.push('المبلغ الإجمالي: ₪48.00');             // → Bordered box
lines.push('--- معلومات العميل ---');              // → Large header
lines.push('');                                     // → 12px space
```

## 🖼️ Logo Setup

The logo appears at the top of the receipt:

**Location:** `pos-print-sdk/poswebview/src/main/res/drawable/receipt_logo.png`

**Specifications:**
- Max width: 150px (auto-scaled)
- Format: PNG (transparent background recommended)
- Position: Centered at top

**To change logo:**
```bash
# Replace the logo file:
cp your_logo.png admin-dashboard/pos-print-sdk/poswebview/src/main/res/drawable/receipt_logo.png

# Then rebuild the APK in Android Studio
```

## 🧪 Testing Your Changes

1. **Edit text content** in `buildReceiptText()` - no rebuild needed for web preview
2. **Test in browser** - Print preview shows HTML version
3. **Edit styling** in `createTextBitmap()` - requires Android Studio rebuild
4. **Rebuild APK** - Only needed when changing Java code
5. **Test on device** - Print actual receipt to verify

## 📍 Quick Reference

### To Add Text Lines:
→ Edit `OrdersPage.jsx` → `buildReceiptText()` function

### To Change Font Sizes:
→ Edit `MainActivity.java` → `createTextBitmap()` method

### To Change Spacing:
→ Edit `MainActivity.java` → Modify `lineHeight` or `padding` variables

### To Change Logo:
→ Replace `receipt_logo.png` in drawable folder → Rebuild APK

### To Preview Visually:
→ Open `RECEIPT_VISUAL_PREVIEW.html` in browser

## ⚠️ Important Notes

1. **Receipt width is fixed** at 384px (standard 58mm thermal paper)
2. **After editing Java**, you must rebuild the APK in Android Studio
3. **Test prints** before deploying to production
4. **RTL text** is automatically handled by Android Canvas
5. **Logo is optional** - if missing, brand name text is shown instead

## 📞 Need Help?

1. Check `RECEIPT_VISUAL_PREVIEW.html` for visual reference
2. Review `ReceiptPreview.html` for HTML/CSS structure
3. Check Java logs for bitmap creation details
4. Test with small changes first

---

**Last Updated:** 2025-01-23  
**Receipt Width:** 384px (58mm thermal paper)  
**Default Font:** Cairo Bold / Sans-serif fallback










