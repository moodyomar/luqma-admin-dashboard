# 🏗️ Building the H10 POS APK

## ✅ **Easiest Method: Android Studio** (RECOMMENDED)

### Step 1: Install Android Studio
If you don't have it:
```bash
# Download from: https://developer.android.com/studio
# Or via Homebrew:
brew install --cask android-studio
```

### Step 2: Open Project
1. Open Android Studio
2. Click **"Open"**
3. Navigate to: `/Users/moody/Documents/Dev/luqma/admin-dashboard/pos-print-sdk`
4. Click **"Open"**

### Step 3: Build APK
1. Wait for Gradle sync to complete (bottom status bar)
2. Click **Build → Build Bundle(s) / APK(s) → Build APK(s)**
3. Wait for build (~2-5 minutes)
4. When done, click **"locate"** in the notification

**Output Location:**
```
poswebview/build/outputs/apk/debug/poswebview-debug.apk
```

---

## ⚙️ Alternative: Command Line (Advanced)

### Prerequisites:
```bash
# Check Java is installed:
java -version
# Should show Java 11 or newer

# If not installed:
brew install openjdk@11
```

### Initialize Gradle Wrapper:
```bash
cd /Users/moody/Documents/Dev/luqma/admin-dashboard/pos-print-sdk

# Download gradle wrapper jar:
gradle wrapper

# This creates gradle/wrapper/gradle-wrapper.jar
```

### Build:
```bash
./gradlew assembleDebug
```

---

## 🚫 Common Issues

### "SDK location not found"
Create `local.properties`:
```bash
echo "sdk.dir=/Users/$(whoami)/Library/Android/sdk" > local.properties
```

### "Java version too old"
```bash
brew install openjdk@11
export JAVA_HOME=$(/usr/libexec/java_home -v 11)
```

### "Gradle wrapper not found"
Run first:
```bash
gradle wrapper
```

---

## 🎯 Quick Decision Guide

**Have Android Studio?** → Use Android Studio ✅  
**Comfortable with terminal?** → Use command line  
**Just want it to work?** → Use Android Studio ✅✅✅

Android Studio handles all dependencies, SDK paths, and build tools automatically!











