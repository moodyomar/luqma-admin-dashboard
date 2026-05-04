package com.luqma.pos;

import android.annotation.SuppressLint;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.graphics.Matrix;
import android.os.IBinder;
import android.os.RemoteException;
import android.os.Build;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.print.PrintJob;
import android.print.PrintJobInfo;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.caysn.autoreplyprint.AutoReplyPrint;
import com.sun.jna.Pointer;
import com.sun.jna.WString;

/**
 * POS Terminal WebView App
 * For H10 Wireless Data Terminal (Android 14)
 * Provides silent printing via JavaScript bridge. Brand name from strings.xml.
 */
public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private AutoReplyPrint printer;
    private Pointer printerHandle;
    private IBinder senraisePrinterService;
    // Load admin URL from resources (configured per client)
    private String getAdminUrl() {
        return getString(R.string.admin_dashboard_url);
    }
    
    private String getBrandName() {
        return getString(R.string.brand_name);
    }
    
    private String getBrandNameAr() {
        return getString(R.string.brand_name_ar);
    }
    
    private static final int BLUETOOTH_PERMISSION_REQUEST_CODE = 100;
    
    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);
        
        // Enable remote debugging (Chrome chrome://inspect) when debugging build
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
        
        // Try to bind to SENRAISE's proprietary printer service
        bindToSenraisePrinter();
        
        // Also try AutoReplyPrint as backup
        requestBluetoothPermissions();
        
        // Configure WebView
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setDatabaseEnabled(true);
        webSettings.setCacheMode(WebSettings.LOAD_DEFAULT);
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowContentAccess(true);
        webSettings.setMediaPlaybackRequiresUserGesture(false);
        webSettings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        
        // Enable zooming for better touch control
        webSettings.setSupportZoom(true);
        webSettings.setBuiltInZoomControls(true);
        webSettings.setDisplayZoomControls(false);
        
        // Add JavaScript interface for printing
        webView.addJavascriptInterface(new PosPrinterBridge(this), "PosPrinter");
        
        // Set WebView clients
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                // Inject helper functions
                injectPrintHelpers();
            }
        });
        
        webView.setWebChromeClient(new WebChromeClient());
        
        // Load admin dashboard from config
        String adminUrl = getAdminUrl();
        android.util.Log.i("POS", "🌐 Loading dashboard: " + adminUrl);
        webView.loadUrl(adminUrl);
    }

    private ServiceConnection printerConnection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder service) {
            senraisePrinterService = service;
            android.util.Log.i("POS", "✅ Connected to SENRAISE PrinterService!");
            Toast.makeText(MainActivity.this, "✅ طابعة SENRAISE متصلة", Toast.LENGTH_SHORT).show();
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            senraisePrinterService = null;
            android.util.Log.w("POS", "⚠️ Disconnected from SENRAISE PrinterService");
        }
    };
    
    private void bindToSenraisePrinter() {
        try {
            Intent intent = new Intent();
            intent.setComponent(new ComponentName("recieptservice.com.recieptservice", 
                                                  "recieptservice.com.recieptservice.service.PrinterService"));
            boolean bound = bindService(intent, printerConnection, Context.BIND_AUTO_CREATE);
            android.util.Log.i("POS", "🔌 Binding to SENRAISE PrinterService: " + bound);
            
            if (!bound) {
                Toast.makeText(this, "⚠️ فشل الاتصال بخدمة الطباعة", Toast.LENGTH_LONG).show();
            }
        } catch (Exception e) {
            android.util.Log.e("POS", "❌ Failed to bind PrinterService: " + e.getMessage());
            Toast.makeText(this, "❌ خطأ في الاتصال: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private void requestBluetoothPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) { // Android 12+
            String[] permissions = {
                android.Manifest.permission.BLUETOOTH_CONNECT,
                android.Manifest.permission.BLUETOOTH_SCAN
            };
            
            boolean needsRequest = false;
            for (String permission : permissions) {
                if (ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED) {
                    needsRequest = true;
                    break;
                }
            }
            
            if (needsRequest) {
                android.util.Log.i("POS", "📱 Requesting Bluetooth permissions...");
                ActivityCompat.requestPermissions(this, permissions, BLUETOOTH_PERMISSION_REQUEST_CODE);
            } else {
                android.util.Log.i("POS", "✅ Bluetooth permissions already granted");
                initializePrinter();
            }
        } else {
            // Android 11 and below - permissions granted at install time
            android.util.Log.i("POS", "✅ Android < 12, using install-time permissions");
            initializePrinter();
        }
    }
    
    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        
        if (requestCode == BLUETOOTH_PERMISSION_REQUEST_CODE) {
            boolean allGranted = true;
            for (int result : grantResults) {
                if (result != PackageManager.PERMISSION_GRANTED) {
                    allGranted = false;
                    break;
                }
            }
            
            if (allGranted) {
                android.util.Log.i("POS", "✅ Bluetooth permissions granted!");
                Toast.makeText(this, "✅ تم منح أذونات البلوتوث", Toast.LENGTH_SHORT).show();
                initializePrinter();
            } else {
                android.util.Log.e("POS", "❌ Bluetooth permissions denied");
                Toast.makeText(this, "⚠️ يرجى منح أذونات البلوتوث للطباعة", Toast.LENGTH_LONG).show();
            }
        }
    }

    private void initializePrinter() {
        try {
            printer = AutoReplyPrint.INSTANCE;
            android.util.Log.i("POS", "🔍 Searching for InnerPrinter via Bluetooth...");
            
            // H10 uses internal Bluetooth printer named "InnerPrinter"
            // Try to connect via Bluetooth SPP (Serial Port Profile)
            
            // First, try to find "InnerPrinter" Bluetooth device
            android.bluetooth.BluetoothAdapter btAdapter = android.bluetooth.BluetoothAdapter.getDefaultAdapter();
            if (btAdapter != null && btAdapter.isEnabled()) {
                android.util.Log.i("POS", "📶 Bluetooth is enabled, searching for paired devices...");
                
                try {
                    java.util.Set<android.bluetooth.BluetoothDevice> pairedDevices = btAdapter.getBondedDevices();
                    for (android.bluetooth.BluetoothDevice device : pairedDevices) {
                        String deviceName = device.getName();
                        String deviceAddress = device.getAddress();
                        android.util.Log.i("POS", "Found paired device: " + deviceName + " (" + deviceAddress + ")");
                        
                        if (deviceName != null && (deviceName.contains("InnerPrinter") || deviceName.contains("Printer") || deviceName.contains("H10"))) {
                            android.util.Log.i("POS", "🎯 Found printer device: " + deviceName + " - attempting connection...");
                            
                            // Try to connect via AutoReplyPrint Bluetooth SPP
                            printerHandle = printer.CP_Port_OpenBtSpp(deviceAddress, 0);
                            
                            if (printerHandle != null && Pointer.nativeValue(printerHandle) != 0) {
                                android.util.Log.i("POS", "✅ Successfully connected to " + deviceName);
                                Toast.makeText(this, "✅ الطابعة متصلة: " + deviceName, Toast.LENGTH_SHORT).show();
                                return;
                            } else {
                                android.util.Log.w("POS", "⚠️ Failed to connect to " + deviceName);
                            }
                        }
                    }
                } catch (SecurityException e) {
                    android.util.Log.e("POS", "❌ Bluetooth permission denied: " + e.getMessage());
                }
            } else {
                android.util.Log.w("POS", "⚠️ Bluetooth is disabled or not available");
            }
            
            // If Bluetooth failed, log detailed error
            android.util.Log.e("POS", "❌ Could not connect to InnerPrinter");
            Toast.makeText(this, "⚠️ لم يتم العثور على الطابعة الداخلية", Toast.LENGTH_LONG).show();
            
        } catch (Exception e) {
            e.printStackTrace();
            android.util.Log.e("POS", "❌ Printer init error: " + e.getMessage());
            Toast.makeText(this, "❌ خطأ: " + e.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private void injectPrintHelpers() {
        String js = "javascript:(function() {" +
                "  console.log('✅ PosPrinter bridge loaded');" +
                "  if (window.PosPrinter) {" +
                "    console.log('✅ PosPrinter.printText available');" +
                "    console.log('✅ PosPrinter.printHtml available');" +
                "    console.log('✅ Device: H10 Wireless Data Terminal');" +
                "  }" +
                "})()";
        webView.evaluateJavascript(js, null);
    }

    /**
     * Helper method to create beautiful receipt bitmap with logo and Arabic RTL support
     * Uses Android's text rendering (which supports Arabic) then converts to image
     */
    /**
     * Helper class to hold receipt style values
     */
    private static class ReceiptStyle {
        int bodyFont = 22;
        int lineHeight = 32;
        int padding = 15;
        int headerFont = 25;
        int totalFont = 26;
        int footerFont = 20;
        int sepMargin = 15;
        int emptyGap = 12;
        int logoMaxWidth = 150;
        int logoSpacingAfter = 25;
        String fontFamily = null;
        /** When true, only section headers and item titles are bold; body lines use normal weight (prefix \u200B in text). */
        boolean titlesBoldOnly = false;
    }

    /** Zero-width space: when titlesBoldOnly is true, lines starting with this are drawn with normal weight. */
    private static final String NORMAL_WEIGHT_PREFIX = "\u200B";
    
    /**
     * Parse receiptStyle JSON and extract all style values
     */
    private ReceiptStyle parseReceiptStyle(String receiptStyleJson) {
        ReceiptStyle style = new ReceiptStyle();
        
        if (receiptStyleJson == null || receiptStyleJson.trim().isEmpty() || receiptStyleJson.equals("null")) {
            return style; // Return defaults
        }
        
        try {
            // Parse numeric values using simple string matching (avoiding JSON library dependency)
            style.bodyFont = parseIntFromJson(receiptStyleJson, "bodyFont", 22);
            style.lineHeight = parseIntFromJson(receiptStyleJson, "lineHeight", 32);
            style.padding = parseIntFromJson(receiptStyleJson, "padding", 15);
            style.headerFont = parseIntFromJson(receiptStyleJson, "headerFont", 25);
            style.totalFont = parseIntFromJson(receiptStyleJson, "totalFont", 26);
            style.footerFont = parseIntFromJson(receiptStyleJson, "footerFont", 20);
            style.sepMargin = parseIntFromJson(receiptStyleJson, "sepMargin", 15);
            style.emptyGap = parseIntFromJson(receiptStyleJson, "emptyGap", 12);
            style.logoMaxWidth = parseIntFromJson(receiptStyleJson, "logoMaxWidth", 150);
            style.logoSpacingAfter = parseIntFromJson(receiptStyleJson, "logoSpacingAfter", 25);
            
            // Parse fontFamily string
            int fontFamilyIndex = receiptStyleJson.indexOf("\"fontFamily\"");
            if (fontFamilyIndex >= 0) {
                int colonIndex = receiptStyleJson.indexOf(":", fontFamilyIndex);
                int startQuote = receiptStyleJson.indexOf("\"", colonIndex) + 1;
                int endQuote = receiptStyleJson.indexOf("\"", startQuote);
                if (startQuote > 0 && endQuote > startQuote) {
                    style.fontFamily = receiptStyleJson.substring(startQuote, endQuote);
                }
            }
            style.titlesBoldOnly = parseBooleanFromJson(receiptStyleJson, "titlesBoldOnly", false);

            android.util.Log.i("POS", "✅ Parsed receiptStyle: bodyFont=" + style.bodyFont + 
                ", lineHeight=" + style.lineHeight + ", padding=" + style.padding);
        } catch (Exception e) {
            android.util.Log.w("POS", "⚠️ Failed to parse receiptStyle: " + e.getMessage());
        }
        
        return style;
    }
    
    /**
     * Extract integer value from JSON string
     */
    private int parseIntFromJson(String json, String key, int defaultValue) {
        try {
            String searchKey = "\"" + key + "\"";
            int keyIndex = json.indexOf(searchKey);
            if (keyIndex >= 0) {
                int colonIndex = json.indexOf(":", keyIndex);
                int valueStart = colonIndex + 1;
                // Skip whitespace
                while (valueStart < json.length() && Character.isWhitespace(json.charAt(valueStart))) {
                    valueStart++;
                }
                // Find end of number (comma, }, or whitespace)
                int valueEnd = valueStart;
                while (valueEnd < json.length() && 
                       (Character.isDigit(json.charAt(valueEnd)) || json.charAt(valueEnd) == '-')) {
                    valueEnd++;
                }
                if (valueEnd > valueStart) {
                    String valueStr = json.substring(valueStart, valueEnd).trim();
                    return Integer.parseInt(valueStr);
                }
            }
        } catch (Exception e) {
            // Return default on any error
        }
        return defaultValue;
    }

    private boolean parseBooleanFromJson(String json, String key, boolean defaultValue) {
        if (json == null) return defaultValue;
        String searchKey = "\"" + key + "\"";
        int keyIndex = json.indexOf(searchKey);
        if (keyIndex >= 0) {
            int colonIndex = json.indexOf(":", keyIndex);
            int valueStart = colonIndex + 1;
            while (valueStart < json.length() && Character.isWhitespace(json.charAt(valueStart))) valueStart++;
            if (valueStart < json.length()) {
                if (json.substring(valueStart).startsWith("true")) return true;
                if (json.substring(valueStart).startsWith("false")) return false;
            }
        }
        return defaultValue;
    }
    
    private Bitmap createTextBitmap(String[] lines, boolean includeHeader, ReceiptStyle style) {
        int width = 384; // 58mm paper = 384 pixels
        int lineHeight = style.lineHeight;
        int padding = style.padding;
        int headerSpace = includeHeader ? 80 : 20; // Upper bound for logo/brand (actual height trimmed after draw)
        
        // Upper-bound height (per-line uses lineHeight; real layout uses less for empty lines / separators — we crop after draw)
        int numLines = lines != null ? lines.length : 0;
        int height = Math.max(100, (numLines * lineHeight) + headerSpace + 24);
        
        android.util.Log.i("POS", "🖼️ Creating beautiful RTL receipt: " + width + "x" + height);
        
        // Create bitmap
        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        
        // White background
        canvas.drawColor(Color.WHITE);
        
        int currentY = 20;
        
        // ============ HEADER WITH LOGO ============
        if (includeHeader) {
            // Try to load logo from resources
            try {
                int logoResId = getResources().getIdentifier("receipt_logo", "drawable", getPackageName());
                if (logoResId != 0) {
                    android.util.Log.i("POS", "📷 Loading logo from resources");
                    Bitmap logoBitmap = BitmapFactory.decodeResource(getResources(), logoResId);
                    
                    if (logoBitmap != null) {
                        // Scale logo to fit (use logoMaxWidth from style)
                        int maxLogoWidth = style.logoMaxWidth;
                        float scale = Math.min(1.0f, (float)maxLogoWidth / logoBitmap.getWidth());
                        int scaledWidth = (int)(logoBitmap.getWidth() * scale);
                        int scaledHeight = (int)(logoBitmap.getHeight() * scale);
                        
                        Matrix matrix = new Matrix();
                        matrix.postScale(scale, scale);
                        Bitmap scaledLogo = Bitmap.createBitmap(logoBitmap, 0, 0, 
                            logoBitmap.getWidth(), logoBitmap.getHeight(), matrix, true);
                        
                        // Draw logo centered
                        int logoX = (width - scaledWidth) / 2;
                        canvas.drawBitmap(scaledLogo, logoX, currentY, null);
                        currentY += scaledHeight + style.logoSpacingAfter; // Use logoSpacingAfter from style
                        
                        android.util.Log.i("POS", "✅ Logo drawn: " + scaledWidth + "x" + scaledHeight);
                    }
                } else {
                    android.util.Log.i("POS", "ℹ️ No logo found, using text header");
                }
            } catch (Exception e) {
                android.util.Log.w("POS", "⚠️ Logo load failed: " + e.getMessage());
            }
            
            // If no logo, show brand name
            if (currentY < 50) {
                // Brand name in English (large, centered)
                Paint headerPaint = new Paint();
                headerPaint.setColor(Color.BLACK);
                headerPaint.setTextSize(46); // brand name (English)
                headerPaint.setAntiAlias(true);
                headerPaint.setTypeface(Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD));
                headerPaint.setTextAlign(Paint.Align.CENTER);
                headerPaint.setFakeBoldText(true);
                
                String brandName = getBrandName().toUpperCase();
                canvas.drawText(brandName, width / 2, currentY + 30, headerPaint);
                
                // Brand name in Arabic (centered, below English)
                Paint arabicHeaderPaint = new Paint();
                arabicHeaderPaint.setColor(Color.BLACK);
                arabicHeaderPaint.setTextSize(38); // brand name (Arabic)
                arabicHeaderPaint.setAntiAlias(true);
                arabicHeaderPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
                arabicHeaderPaint.setTextAlign(Paint.Align.CENTER);
                
                String brandNameAr = getBrandNameAr();
                canvas.drawText(brandNameAr, width / 2, currentY + 60, arabicHeaderPaint);
                
                currentY += 75;
            }
            
            // Spacing after logo / text header (no horizontal rule — order lines follow directly)
            currentY += 18;
        }
        
        // ============ BODY TEXT (RTL with selected font) ============
        // Map CSS font-family to Android Typeface
        Typeface selectedFont = Typeface.SANS_SERIF; // Default fallback
        
        String fontFamily = style.fontFamily;
        if (fontFamily != null && !fontFamily.isEmpty()) {
            // Parse font-family string (may contain multiple fonts like "'Cairo', 'Tahoma', sans-serif")
            String fontFamilyLower = fontFamily.toLowerCase();
            
            if (fontFamilyLower.contains("cairo")) {
                // Try to load Cairo font from assets
                try {
                    Typeface customFont = Typeface.createFromAsset(getAssets(), "fonts/Cairo-Bold.ttf");
                    selectedFont = customFont;
                    android.util.Log.i("POS", "✅ Using Cairo font from assets");
                } catch (Exception e) {
                    android.util.Log.i("POS", "ℹ️ Cairo font not found in assets, using sans-serif");
                    selectedFont = Typeface.SANS_SERIF;
                }
            } else if (fontFamilyLower.contains("arial")) {
                selectedFont = Typeface.create("Arial", Typeface.BOLD);
                android.util.Log.i("POS", "✅ Using Arial font");
            } else if (fontFamilyLower.contains("tahoma")) {
                selectedFont = Typeface.create("Tahoma", Typeface.BOLD);
                android.util.Log.i("POS", "✅ Using Tahoma font");
            } else if (fontFamilyLower.contains("system-ui") || fontFamilyLower.contains("system")) {
                selectedFont = Typeface.DEFAULT;
                android.util.Log.i("POS", "✅ Using system default font");
            } else {
                // Default to sans-serif
                selectedFont = Typeface.SANS_SERIF;
                android.util.Log.i("POS", "ℹ️ Using default sans-serif font");
            }
        } else {
            // No fontFamily specified, try Cairo as default (backward compatibility)
            try {
                Typeface customFont = Typeface.createFromAsset(getAssets(), "fonts/Cairo-Bold.ttf");
                selectedFont = customFont;
                android.util.Log.i("POS", "✅ Using Cairo font from assets (default)");
            } catch (Exception e) {
                android.util.Log.i("POS", "ℹ️ Cairo font not found, using sans-serif");
                selectedFont = Typeface.SANS_SERIF;
            }
        }
        
        Typeface cairoFont = selectedFont; // Keep variable name for compatibility
        
        // Setup paint for regular text - use bodyFont from style
        Paint textPaint = new Paint();
        textPaint.setColor(Color.BLACK);
        textPaint.setTextSize(style.bodyFont); // Use bodyFont from style
        textPaint.setAntiAlias(true);
        textPaint.setTypeface(Typeface.create(cairoFont, Typeface.BOLD));
        textPaint.setFakeBoldText(true); // Extra bold for darker ink
        textPaint.setTextAlign(Paint.Align.RIGHT); // RTL

        // When titlesBoldOnly: body lines are prefixed with \u200B and drawn with normal weight
        Paint textPaintNormal = new Paint();
        textPaintNormal.setColor(Color.BLACK);
        textPaintNormal.setTextSize(style.bodyFont);
        textPaintNormal.setAntiAlias(true);
        textPaintNormal.setTypeface(Typeface.create(cairoFont, Typeface.NORMAL));
        textPaintNormal.setTextAlign(Paint.Align.RIGHT);
        
        // Paint for section headers - use headerFont from style
        Paint headerTextPaint = new Paint();
        headerTextPaint.setColor(Color.BLACK);
        headerTextPaint.setTextSize(style.headerFont); // Use headerFont from style
        headerTextPaint.setAntiAlias(true);
        headerTextPaint.setTypeface(Typeface.create(cairoFont, Typeface.BOLD));
        headerTextPaint.setFakeBoldText(true);
        headerTextPaint.setTextAlign(Paint.Align.RIGHT);
        
        // Draw lines with smart formatting
        for (int i = 0; i < lines.length; i++) {
            String line = lines[i];
            if (line == null) continue;

            // When titlesBoldOnly, lines starting with \u200B are drawn with normal weight
            boolean useNormalWeight = style.titlesBoldOnly && line.startsWith(NORMAL_WEIGHT_PREFIX);
            String displayLine = useNormalWeight ? line.substring(NORMAL_WEIGHT_PREFIX.length()) : line;
            
            // Skip empty lines at start
            if (displayLine.trim().isEmpty()) {
                currentY += style.emptyGap; // Use emptyGap from style
                continue;
            }
            
            // Detect separator lines (====, ---, - - -)
            // Only treat lines that are PURE separators (no text content) as separator lines
            String trimmedLine = displayLine.trim();
            if (trimmedLine.startsWith("===")) {
                // Check if it's a pure separator (only contains =, -, or spaces)
                String withoutEquals = trimmedLine.replace("=", "").replace("-", "").replace(" ", "");
                if (withoutEquals.isEmpty()) {
                    // Thick solid line
                    Paint separatorPaint = new Paint();
                    separatorPaint.setColor(Color.BLACK);
                    separatorPaint.setStrokeWidth(2);
                    canvas.drawLine(padding, currentY + 5, width - padding, currentY + 5, separatorPaint);
                    currentY += style.sepMargin; // Use sepMargin from style
                    continue;
                }
            } else if (trimmedLine.startsWith("---") || trimmedLine.startsWith("- - -")) {
                // Check if it's a pure separator (only contains dashes, spaces, or dots)
                // If it contains actual text (like "--- معلومات العميل ---"), render as text
                String withoutSeparators = trimmedLine.replace("-", "").replace(" ", "").replace(".", "");
                if (withoutSeparators.isEmpty()) {
                    // Thin dashed line - pure separator
                    Paint separatorPaint = new Paint();
                    separatorPaint.setColor(Color.GRAY);
                    separatorPaint.setStrokeWidth(1);
                    canvas.drawLine(padding, currentY + 5, width - padding, currentY + 5, separatorPaint);
                    currentY += style.sepMargin; // Use sepMargin from style
                    continue;
                }
                // If it contains text (like "--- معلومات العميل ---"), fall through to render as text
            }
            
            // **SPECIAL: Draw border around total amount** (check displayLine so \u200B prefix doesn't break detection)
            if (displayLine.contains("المبلغ الإجمالي") || displayLine.contains("Total Amount")) {
                // Draw filled background
                Paint bgPaint = new Paint();
                bgPaint.setColor(Color.rgb(245, 245, 245)); // Light gray background
                bgPaint.setStyle(Paint.Style.FILL);
                canvas.drawRect(padding, currentY - 32, width - padding, currentY + 18, bgPaint);
                
                // Draw border around total
                Paint borderPaint = new Paint();
                borderPaint.setColor(Color.BLACK);
                borderPaint.setStyle(Paint.Style.STROKE);
                borderPaint.setStrokeWidth(3);
                canvas.drawRect(padding, currentY - 32, width - padding, currentY + 18, borderPaint);
                
                // Draw text in center (not right-aligned for total)
                Paint totalPaint = new Paint();
                totalPaint.setColor(Color.BLACK);
                totalPaint.setTextSize(style.totalFont); // Use totalFont from style
                totalPaint.setAntiAlias(true);
                totalPaint.setTypeface(Typeface.create(cairoFont, Typeface.BOLD));
                totalPaint.setFakeBoldText(true);
                totalPaint.setTextAlign(Paint.Align.CENTER);
                
                canvas.drawText(displayLine, width / 2, currentY, totalPaint);
                currentY += style.lineHeight + 10; // Use lineHeight from style
                continue;
            }
            
            // Use header paint for section titles (contains "معلومات" or "تفاصيل"); when titlesBoldOnly use normal paint for body
            Paint activePaint;
            if (useNormalWeight) {
                activePaint = textPaintNormal;
            } else if (displayLine.contains("معلومات") || displayLine.contains("تفاصيل") || displayLine.contains("رقم")) {
                activePaint = headerTextPaint;
            } else {
                activePaint = textPaint;
            }
            
            // Draw text from right edge (RTL)
            canvas.drawText(displayLine, width - padding, currentY, activePaint);
            currentY += lineHeight;
        }
        
        android.util.Log.i("POS", "🖼️ Beautiful RTL receipt created!");
        
        // Trim excess white: layout uses emptyGap / sepMargin for many lines, not full lineHeight
        int bottomPad = Math.max(12, style.lineHeight / 2 + 4);
        int cropHeight = Math.min(height, Math.max(1, currentY + bottomPad));
        if (cropHeight < height) {
            Bitmap trimmed = Bitmap.createBitmap(bitmap, 0, 0, width, cropHeight);
            bitmap.recycle();
            bitmap = trimmed;
            android.util.Log.i("POS", "🖼️ Trimmed receipt bitmap height " + height + " → " + cropHeight);
        }
        
        return bitmap;
    }

    /**
     * JavaScript Bridge for POS Printer
     * Exposed to JavaScript as window.PosPrinter
     */
    public class PosPrinterBridge {
        Context context;

        PosPrinterBridge(Context c) {
            context = c;
        }

        /**
         * Print text receipt silently (no dialog) - backward compatible overload
         * @param text Receipt text content
         * @return "success" or error message
         */
        @JavascriptInterface
        public String printText(String text) {
            // Call the main method with empty receiptStyleJson for backward compatibility
            return printText(text, "");
        }

        /**
         * Print text receipt silently (no dialog) - with receipt style
         * @param text Receipt text content
         * @param receiptStyleJson Optional JSON string with receipt style (fontFamily, etc.)
         * @return "success" or error message
         */
        @JavascriptInterface
        public String printText(String text, String receiptStyleJson) {
            // Handle backward compatibility: if receiptStyleJson is null or empty, treat as no style
            if (receiptStyleJson == null) {
                receiptStyleJson = "";
            }
            try {
                if (printer == null || printerHandle == null || Pointer.nativeValue(printerHandle) == 0) {
                    return "error: printer not initialized";
                }
                
                android.util.Log.i("POS", "📝 Printing order SILENTLY...");
                
                // Parse receiptStyle JSON to get all style values
                ReceiptStyle receiptStyle = parseReceiptStyle(receiptStyleJson);
                
                // Build full receipt with Windows-1256 for Arabic
                android.util.Log.i("POS", "🖼️ Printing beautiful order receipt with logo & Arabic");
                
                // Check if footer is already in the text (added by JavaScript from receiptStyle)
                // Footer typically contains "Thank you" or "شكراً"
                boolean hasFooter = text.contains("Thank you") || text.contains("شكراً") || 
                                   text.contains("شكرا") || text.trim().endsWith("App");
                
                // Build clean receipt - add footer only if not already present
                String fullText = text;
                if (!hasFooter) {
                    // Fallback: add footer from strings.xml if JavaScript didn't add it
                    fullText = text + 
                            "\n\n" +
                            getString(R.string.receipt_thank_you_en) + " " + getBrandName() + "\n" +
                            getString(R.string.receipt_thank_you_ar) + " " + getString(R.string.brand_name_ar_short);
                }
                
                android.util.Log.i("POS", "📝 Receipt length: " + fullText.length() + " chars");
                
                // Create beautiful bitmap with header/logo
                String[] lines = fullText.split("\n");
                Bitmap receiptBitmap = createTextBitmap(lines, true, receiptStyle);
                
                android.util.Log.i("POS", "🖼️ Beautiful receipt bitmap: " + receiptBitmap.getWidth() + "x" + receiptBitmap.getHeight());
                
                // Print bitmap
                printer.CP_Pos_SetAlignment(printerHandle, 0);
                boolean success = AutoReplyPrint.CP_Pos_PrintRasterImageFromData_Helper.PrintRasterImageFromBitmap(
                    printerHandle,
                    receiptBitmap.getWidth(),
                    receiptBitmap.getHeight(),
                    receiptBitmap,
                    0,
                    0
                );
                
                android.util.Log.i("POS", "🖼️ Beautiful receipt printed: " + success);
                
                if (success) {
                    printer.CP_Pos_FeedLine(printerHandle, 5); // More feed lines
                    runOnUiThread(() -> 
                        Toast.makeText(context, "✅ تمت الطباعة بنجاح", Toast.LENGTH_SHORT).show()
                    );
                    return "success";
                } else {
                    return "error: print command failed";
                }
                
            } catch (Exception e) {
                android.util.Log.e("POS", "❌ Print error: " + e.getMessage());
                return "error: " + e.getMessage();
            }
        }

        /**
         * Print HTML content (simplified - converts to text)
         * @param html HTML content
         * @return "success" or error message
         */
        @JavascriptInterface
        public String printHtml(String html) {
            // Strip HTML tags and print as text
            String text = html.replaceAll("<[^>]*>", "").replaceAll("&nbsp;", " ");
            return printText(text);
        }

        /**
         * Get printer status
         * @return JSON string with printer info
         */
        @JavascriptInterface
        public String getPrinterStatus() {
            if (printer == null || printerHandle == null || Pointer.nativeValue(printerHandle) == 0) {
                return "{\"status\":\"error\",\"message\":\"printer not initialized\"}";
            }
            try {
                // Simple status check - if handle exists, assume ready
                boolean ready = Pointer.nativeValue(printerHandle) != 0;
                return "{\"status\":\"" + (ready ? "ready" : "error") + "\",\"device\":\"H10\"}";
            } catch (Exception e) {
                return "{\"status\":\"error\",\"message\":\"" + e.getMessage() + "\"}";
            }
        }

        /**
         * Test print - prints a test receipt
         * @return "success" or error message
         */
        @JavascriptInterface
        public String testPrint() {
            try {
                if (printer == null || printerHandle == null || Pointer.nativeValue(printerHandle) == 0) {
                    return "error: printer not initialized";
                }
                
                android.util.Log.i("POS", "🧪 Test print with beautiful formatting");
                
                // Clean test receipt (header/logo added by createTextBitmap)
                String testText = "اختبار الطباعة - Test Print\n" +
                        "---\n" +
                        "الجهاز: H10 Terminal\n" +
                        "التطبيق: " + getString(R.string.app_name) + "\n" +
                        "الحالة: متصل بنجاح\n" +
                        "\n" +
                        "--- اختبار النصوص ---\n" +
                        "إنجليزي: ABCDEFGH 1234\n" +
                        "عربي: طباعة اختبار\n" +
                        "عبري: בדיקה הדפסה\n" +
                        "رموز: !@#$%^&*()\n" +
                        "\n" +
                        "التاريخ: " + new java.text.SimpleDateFormat("dd/MM/yyyy").format(new java.util.Date()) + "\n" +
                        "الوقت: " + new java.text.SimpleDateFormat("HH:mm:ss").format(new java.util.Date()) + "\n" +
                        "\n" +
                        "---\n" +
                        "الطباعة تعمل بشكل ممتاز!\n" +
                        "✓ النص واضح وسهل القراءة\n" +
                        "✓ العربية مقروءة تماماً";
                
                android.util.Log.i("POS", "🖼️ Printing beautiful receipt with logo & Arabic...");
                
                // Split into lines
                String[] lines = testText.split("\n");
                android.util.Log.i("POS", "🖼️ Split into " + lines.length + " lines");
                
                // Create beautiful bitmap with header/logo (Android renders Arabic correctly!)
                ReceiptStyle defaultStyle = new ReceiptStyle(); // Use defaults for test print
                Bitmap textBitmap = createTextBitmap(lines, true, defaultStyle);
                
                android.util.Log.i("POS", "🖼️ Bitmap size: " + textBitmap.getWidth() + "x" + textBitmap.getHeight());
                
                // Print bitmap using helper method (handles conversion internally)
                printer.CP_Pos_SetAlignment(printerHandle, 0);
                boolean success = AutoReplyPrint.CP_Pos_PrintRasterImageFromData_Helper.PrintRasterImageFromBitmap(
                    printerHandle,
                    textBitmap.getWidth(),
                    textBitmap.getHeight(),
                    textBitmap,
                    0,  // binaryzation: 0=auto threshold
                    0   // compress: 0=none
                );
                
                android.util.Log.i("POS", "🖼️ Beautiful receipt printed: " + success);
                
                if (success) {
                    printer.CP_Pos_FeedLine(printerHandle, 4);
                    runOnUiThread(() -> 
                        Toast.makeText(context, "✅ تمت الطباعة", Toast.LENGTH_SHORT).show()
                    );
                    return "success";
                } else {
                    return "error: print failed";
                }
                
            } catch (Exception e) {
                android.util.Log.e("POS", "❌ Error: " + e.getMessage());
                return "error: " + e.getMessage();
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        
        // Unbind from SENRAISE service
        try {
            unbindService(printerConnection);
        } catch (Exception e) {
            // Ignore if not bound
        }
        
        if (printer != null && printerHandle != null) {
            try {
                printer.CP_Port_Close(printerHandle);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
        if (webView != null) {
            webView.destroy();
        }
    }
}

