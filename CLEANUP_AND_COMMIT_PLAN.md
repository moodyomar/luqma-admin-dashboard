# 🧹 Cleanup and Commit Plan

## 📋 Current Status

### Modified Files (Not Committed):
- `pages/ReceiptPreview.html` - Modified (development/test tool)
- `pos-print-sdk/poswebview/src/main/res/values/strings.xml` - Modified (POS SDK config)

### Untracked Files:
- `AUTO_PRINT_ON_ACCEPT.md` - Documentation
- `DEPLOY_WORD_WRAP_FIX.md` - Documentation
- `RECEIPT_EDITING_GUIDE.md` - Documentation
- `RECEIPT_VISUAL_PREVIEW.html` - Test tool
- `TEST_RECEIPT_WRAPPING.md` - Documentation
- `pages/ReceiptTestPreview.html` - Test tool
- `pages/ReceiptWordWrapPreview.html` - Test tool

---

## ✅ What NEEDS to be Committed

### 1. POS SDK Source Code (CRITICAL) ✅
- **`pos-print-sdk/`** - Source code is NEEDED for POS printing
- ✅ Already in repo (source files)
- ✅ Build artifacts are ignored (via .gitignore)
- **Action**: Commit any source code changes

### 2. Production Code Changes ✅
- Already committed:
  - `pages/OrdersPage.jsx` - Auto-print + word wrapping
  - `src/components/OptionsEditor.jsx` - UI improvements

---

## 🚫 What Should NOT be Committed

### 1. Test/Preview HTML Files (Development Tools)
These are for local testing only:
- ❌ `pages/ReceiptPreview.html` - Test preview tool
- ❌ `pages/ReceiptTestPreview.html` - Test tool
- ❌ `RECEIPT_VISUAL_PREVIEW.html` - Test tool
- ❌ `pages/ReceiptWordWrapPreview.html` - Test tool

**Reason**: Not used in production, only for development/testing

**Action**: Add to .gitignore OR commit as optional dev tools

### 2. Documentation Files (Optional)
- `AUTO_PRINT_ON_ACCEPT.md` - Documentation
- `DEPLOY_WORD_WRAP_FIX.md` - Documentation
- `RECEIPT_EDITING_GUIDE.md` - Documentation
- `TEST_RECEIPT_WRAPPING.md` - Documentation

**Action**: Can commit (helpful) or ignore

---

## 🎯 Recommendation

### Option A: Minimal (Production Only)
- ✅ Commit: `pos-print-sdk/poswebview/src/main/res/values/strings.xml` (if needed)
- ❌ Ignore: All test HTML files
- ❌ Ignore: Documentation (optional)

### Option B: Complete (Include Dev Tools)
- ✅ Commit: All source code changes
- ✅ Commit: Test preview tools (helpful for debugging)
- ✅ Commit: Documentation (helpful for future reference)

---

## 💡 My Recommendation: **Option B**

**Why?**
- Test tools help with debugging receipts locally
- Documentation helps future developers
- Small file sizes, no harm in including
- Already excluded build artifacts via .gitignore

**Files to Commit:**
1. ✅ `pos-print-sdk/poswebview/src/main/res/values/strings.xml` (if it has important changes)
2. ✅ `pages/ReceiptPreview.html` (updated for word wrapping)
3. ✅ Test preview HTML files (helpful for debugging)
4. ✅ Documentation files (helpful reference)

**Files to Ignore:**
- Already ignored: Build artifacts (via .gitignore)
- Already ignored: node_modules, dist, etc.

---

## 📝 Action Plan

1. **Check `strings.xml` changes** - If important, commit it
2. **Decide on test tools** - Commit or ignore?
3. **Update .gitignore** if needed (for test files)
4. **Commit everything needed**
5. **Push to deploy**










