# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.

# Keep JavaScript interface methods
-keepclassmembers class com.luqma.pos.MainActivity$PosPrinterBridge {
    public *;
}

# Keep WebView classes
-keep class android.webkit.** { *; }

# Keep printer library
-keep class com.caysn.** { *; }
-keep interface com.caysn.** { *; }















