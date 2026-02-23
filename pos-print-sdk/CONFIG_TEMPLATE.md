# 🔧 POS Terminal Configuration Template

## For Each New Client/Restaurant

### **Step 1: Update config.xml**

**File:** `poswebview/src/main/res/values/config.xml`

```xml
<!-- CHANGE THESE FOR EACH CLIENT -->
<string name="admin_dashboard_url">https://admin.CLIENT_NAME.co.il/</string>
<string name="app_name_pos">CLIENT_NAME POS</string>

<color name="brand_primary">#YOUR_COLOR</color>
```

### **Step 2: Update AndroidManifest.xml (Optional)**

**File:** `poswebview/src/main/AndroidManifest.xml`

```xml
<!-- Update package name for unique app ID (optional) -->
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.CLIENT_NAME.pos">
```

### **Step 3: Update build.gradle (Optional)**

**File:** `poswebview/build.gradle`

```gradle
defaultConfig {
    applicationId "com.CLIENT_NAME.pos"  // Unique per client
    // ... rest stays same
}
```

---

## 🤖 Automated Configuration (For Init Script)

### **Variables to Replace:**

| Variable | Example | Location |
|----------|---------|----------|
| `{{ADMIN_URL}}` | Your dashboard URL | `config.xml` / strings.xml |
| `{{APP_NAME}}` | POS Terminal (or client name) | strings.xml |
| `{{BRAND_COLOR}}` | `#2e7d32` | `config.xml` line 15 |
| `{{PACKAGE_NAME}}` | e.g. `com.luqma.pos` (or per client) | `AndroidManifest.xml` |
| `{{APPLICATION_ID}}` | Same as package | `build.gradle` |

### **Script Example:**

```bash
# In init script, after cloning:
sed -i '' "s|https://your-dashboard.example.com/|$ADMIN_URL|g" pos-print-sdk/poswebview/src/main/res/values/strings.xml
sed -i '' "s|POS Terminal|$BRAND_NAME POS|g" pos-print-sdk/poswebview/src/main/res/values/strings.xml
sed -i '' "s|#2e7d32|$BRAND_COLOR|g" pos-print-sdk/poswebview/src/main/res/values/config.xml
```

---

## 📝 Example Configurations

### **Client: Pizza Palace**
```xml
<string name="admin_dashboard_url">https://admin.pizzapalace.co.il/</string>
<string name="app_name_pos">Pizza Palace POS</string>
<color name="brand_primary">#e74c3c</color>
```

### **Client: Sushi Bar**
```xml
<string name="admin_dashboard_url">https://admin.sushibar.co.il/</string>
<string name="app_name_pos">Sushi Bar POS</string>
<color name="brand_primary">#3498db</color>
```

---

## ✅ What Stays Generic

These files work for ALL clients (no changes needed):
- `MainActivity.java` - All logic is generic
- `activity_main.xml` - Layout is generic
- `build.gradle` (root) - Build config is generic
- All printer logic - Works for all H10 terminals

---

## 🔄 Integration with Sync Script

The sync script should:
1. Copy entire `pos-print-sdk/` folder to template
2. Mark `config.xml` as **CLIENT-SPECIFIC** (like brandConfig.js)
3. Preserve `config.xml` during syncs
4. Update init script to configure it

---

**This makes POS app fully white-label and clone-ready!** 🎉

