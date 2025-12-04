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
 * Luqma POS Terminal WebView App
 * For H10 Wireless Data Terminal (Android 14)
 * Provides silent printing via JavaScript bridge
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
        android.util.Log.i("LuqmaPOS", "🌐 Loading dashboard: " + adminUrl);
        webView.loadUrl(adminUrl);
    }

    private ServiceConnection printerConnection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder service) {
            senraisePrinterService = service;
            android.util.Log.i("LuqmaPOS", "✅ Connected to SENRAISE PrinterService!");
            Toast.makeText(MainActivity.this, "✅ طابعة SENRAISE متصلة", Toast.LENGTH_SHORT).show();
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            senraisePrinterService = null;
            android.util.Log.w("LuqmaPOS", "⚠️ Disconnected from SENRAISE PrinterService");
        }
    };
    
    private void bindToSenraisePrinter() {
        try {
            Intent intent = new Intent();
            intent.setComponent(new ComponentName("recieptservice.com.recieptservice", 
                                                  "recieptservice.com.recieptservice.service.PrinterService"));
            boolean bound = bindService(intent, printerConnection, Context.BIND_AUTO_CREATE);
            android.util.Log.i("LuqmaPOS", "🔌 Binding to SENRAISE PrinterService: " + bound);
            
            if (!bound) {
                Toast.makeText(this, "⚠️ فشل الاتصال بخدمة الطباعة", Toast.LENGTH_LONG).show();
            }
        } catch (Exception e) {
            android.util.Log.e("LuqmaPOS", "❌ Failed to bind PrinterService: " + e.getMessage());
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
                android.util.Log.i("LuqmaPOS", "📱 Requesting Bluetooth permissions...");
                ActivityCompat.requestPermissions(this, permissions, BLUETOOTH_PERMISSION_REQUEST_CODE);
            } else {
                android.util.Log.i("LuqmaPOS", "✅ Bluetooth permissions already granted");
                initializePrinter();
            }
        } else {
            // Android 11 and below - permissions granted at install time
            android.util.Log.i("LuqmaPOS", "✅ Android < 12, using install-time permissions");
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
                android.util.Log.i("LuqmaPOS", "✅ Bluetooth permissions granted!");
                Toast.makeText(this, "✅ تم منح أذونات البلوتوث", Toast.LENGTH_SHORT).show();
                initializePrinter();
            } else {
                android.util.Log.e("LuqmaPOS", "❌ Bluetooth permissions denied");
                Toast.makeText(this, "⚠️ يرجى منح أذونات البلوتوث للطباعة", Toast.LENGTH_LONG).show();
            }
        }
    }

    private void initializePrinter() {
        try {
            printer = AutoReplyPrint.INSTANCE;
            android.util.Log.i("LuqmaPOS", "🔍 Searching for InnerPrinter via Bluetooth...");
            
            // H10 uses internal Bluetooth printer named "InnerPrinter"
            // Try to connect via Bluetooth SPP (Serial Port Profile)
            
            // First, try to find "InnerPrinter" Bluetooth device
            android.bluetooth.BluetoothAdapter btAdapter = android.bluetooth.BluetoothAdapter.getDefaultAdapter();
            if (btAdapter != null && btAdapter.isEnabled()) {
                android.util.Log.i("LuqmaPOS", "📶 Bluetooth is enabled, searching for paired devices...");
                
                try {
                    java.util.Set<android.bluetooth.BluetoothDevice> pairedDevices = btAdapter.getBondedDevices();
                    for (android.bluetooth.BluetoothDevice device : pairedDevices) {
                        String deviceName = device.getName();
                        String deviceAddress = device.getAddress();
                        android.util.Log.i("LuqmaPOS", "Found paired device: " + deviceName + " (" + deviceAddress + ")");
                        
                        if (deviceName != null && (deviceName.contains("InnerPrinter") || deviceName.contains("Printer") || deviceName.contains("H10"))) {
                            android.util.Log.i("LuqmaPOS", "🎯 Found printer device: " + deviceName + " - attempting connection...");
                            
                            // Try to connect via AutoReplyPrint Bluetooth SPP
                            printerHandle = printer.CP_Port_OpenBtSpp(deviceAddress, 0);
                            
                            if (printerHandle != null && Pointer.nativeValue(printerHandle) != 0) {
                                android.util.Log.i("LuqmaPOS", "✅ Successfully connected to " + deviceName);
                                Toast.makeText(this, "✅ الطابعة متصلة: " + deviceName, Toast.LENGTH_SHORT).show();
                                return;
                            } else {
                                android.util.Log.w("LuqmaPOS", "⚠️ Failed to connect to " + deviceName);
                            }
                        }
                    }
                } catch (SecurityException e) {
                    android.util.Log.e("LuqmaPOS", "❌ Bluetooth permission denied: " + e.getMessage());
                }
            } else {
                android.util.Log.w("LuqmaPOS", "⚠️ Bluetooth is disabled or not available");
            }
            
            // If Bluetooth failed, log detailed error
            android.util.Log.e("LuqmaPOS", "❌ Could not connect to InnerPrinter");
            Toast.makeText(this, "⚠️ لم يتم العثور على الطابعة الداخلية", Toast.LENGTH_LONG).show();
            
        } catch (Exception e) {
            e.printStackTrace();
            android.util.Log.e("LuqmaPOS", "❌ Printer init error: " + e.getMessage());
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
    private Bitmap createTextBitmap(String[] lines, boolean includeHeader) {
        int width = 384; // 58mm paper = 384 pixels
        int lineHeight = 32;
        int padding = 15;
        int headerSpace = includeHeader ? 80 : 20; // Space for logo/brand
        
        // Calculate height
        int numLines = lines != null ? lines.length : 0;
        int height = Math.max(100, (numLines * lineHeight) + headerSpace + 40);
        
        android.util.Log.i("LuqmaPOS", "🖼️ Creating beautiful RTL receipt: " + width + "x" + height);
        
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
                    android.util.Log.i("LuqmaPOS", "📷 Loading logo from resources");
                    Bitmap logoBitmap = BitmapFactory.decodeResource(getResources(), logoResId);
                    
                    if (logoBitmap != null) {
                        // Scale logo to fit (max 150px wide for better quality)
                        int maxLogoWidth = 150;
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
                        currentY += scaledHeight + 25; // More space under logo
                        
                        android.util.Log.i("LuqmaPOS", "✅ Logo drawn: " + scaledWidth + "x" + scaledHeight);
                    }
                } else {
                    android.util.Log.i("LuqmaPOS", "ℹ️ No logo found, using text header");
                }
            } catch (Exception e) {
                android.util.Log.w("LuqmaPOS", "⚠️ Logo load failed: " + e.getMessage());
            }
            
            // If no logo, show brand name
            if (currentY < 50) {
                // Brand name in English (large, centered)
                Paint headerPaint = new Paint();
                headerPaint.setColor(Color.BLACK);
                headerPaint.setTextSize(36);
                headerPaint.setAntiAlias(true);
                headerPaint.setTypeface(Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD));
                headerPaint.setTextAlign(Paint.Align.CENTER);
                headerPaint.setFakeBoldText(true);
                
                String brandName = getBrandName().toUpperCase();
                canvas.drawText(brandName, width / 2, currentY + 30, headerPaint);
                
                // Brand name in Arabic (centered, below English)
                Paint arabicHeaderPaint = new Paint();
                arabicHeaderPaint.setColor(Color.BLACK);
                arabicHeaderPaint.setTextSize(28);
                arabicHeaderPaint.setAntiAlias(true);
                arabicHeaderPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
                arabicHeaderPaint.setTextAlign(Paint.Align.CENTER);
                
                String brandNameAr = getBrandNameAr();
                canvas.drawText(brandNameAr, width / 2, currentY + 60, arabicHeaderPaint);
                
                currentY += 75;
            }
            
            // Decorative line under header
            Paint linePaint = new Paint();
            linePaint.setColor(Color.BLACK);
            linePaint.setStrokeWidth(2);
            canvas.drawLine(padding, currentY + 5, width - padding, currentY + 5, linePaint);
            
            currentY += 25;
        }
        
        // ============ BODY TEXT (RTL with Cairo-style font) ============
        // Try to load Cairo font, fallback to sans-serif (similar look)
        Typeface cairoFont = Typeface.SANS_SERIF; // Sans-serif is closest to Cairo
        try {
            // Try to load custom Cairo font if available
            Typeface customFont = Typeface.createFromAsset(getAssets(), "fonts/Cairo-Bold.ttf");
            cairoFont = customFont;
            android.util.Log.i("LuqmaPOS", "✅ Using Cairo font from assets");
        } catch (Exception e) {
            android.util.Log.i("LuqmaPOS", "ℹ️ Cairo font not found, using sans-serif");
        }
        
        // Setup paint for regular text - BOLD, DARK, Cairo-style
        Paint textPaint = new Paint();
        textPaint.setColor(Color.BLACK);
        textPaint.setTextSize(22);
        textPaint.setAntiAlias(true);
        textPaint.setTypeface(Typeface.create(cairoFont, Typeface.BOLD));
        textPaint.setFakeBoldText(true); // Extra bold for darker ink
        textPaint.setTextAlign(Paint.Align.RIGHT); // RTL
        
        // Paint for section headers (slightly larger)
        Paint headerTextPaint = new Paint();
        headerTextPaint.setColor(Color.BLACK);
        headerTextPaint.setTextSize(25);
        headerTextPaint.setAntiAlias(true);
        headerTextPaint.setTypeface(Typeface.create(cairoFont, Typeface.BOLD));
        headerTextPaint.setFakeBoldText(true);
        headerTextPaint.setTextAlign(Paint.Align.RIGHT);
        
        // Draw lines with smart formatting
        for (int i = 0; i < lines.length; i++) {
            String line = lines[i];
            if (line == null) continue;
            
            // Skip empty lines at start
            if (line.trim().isEmpty()) {
                currentY += 12; // Small gap for empty lines
                continue;
            }
            
            // Detect separator lines (====, ---, - - -)
            if (line.trim().startsWith("===")) {
                // Thick solid line
                Paint separatorPaint = new Paint();
                separatorPaint.setColor(Color.BLACK);
                separatorPaint.setStrokeWidth(2);
                canvas.drawLine(padding + 10, currentY + 10, width - padding - 10, currentY + 10, separatorPaint);
                currentY += 20;
                continue;
            } else if (line.trim().startsWith("---") || line.trim().startsWith("- - -")) {
                // Thin dashed line
                Paint separatorPaint = new Paint();
                separatorPaint.setColor(Color.GRAY);
                separatorPaint.setStrokeWidth(1);
                canvas.drawLine(padding + 10, currentY + 10, width - padding - 10, currentY + 10, separatorPaint);
                currentY += 20;
                continue;
            }
            
            // **SPECIAL: Draw border around total amount**
            if (line.contains("المبلغ الإجمالي") || line.contains("Total Amount")) {
                // Draw filled background
                Paint bgPaint = new Paint();
                bgPaint.setColor(Color.rgb(245, 245, 245)); // Light gray background
                bgPaint.setStyle(Paint.Style.FILL);
                canvas.drawRect(padding, currentY - 25, width - padding, currentY + 12, bgPaint);
                
                // Draw border around total
                Paint borderPaint = new Paint();
                borderPaint.setColor(Color.BLACK);
                borderPaint.setStyle(Paint.Style.STROKE);
                borderPaint.setStrokeWidth(3);
                canvas.drawRect(padding, currentY - 25, width - padding, currentY + 12, borderPaint);
                
                // Draw text in center (not right-aligned for total)
                Paint totalPaint = new Paint();
                totalPaint.setColor(Color.BLACK);
                totalPaint.setTextSize(26);
                totalPaint.setAntiAlias(true);
                totalPaint.setTypeface(Typeface.create(cairoFont, Typeface.BOLD));
                totalPaint.setFakeBoldText(true);
                totalPaint.setTextAlign(Paint.Align.CENTER);
                
                canvas.drawText(line, width / 2, currentY, totalPaint);
                currentY += 40;
                continue;
            }
            
            // Use header paint for section titles (contains "معلومات" or "تفاصيل")
            Paint activePaint = (line.contains("معلومات") || line.contains("تفاصيل") || line.contains("رقم"))
                ? headerTextPaint : textPaint;
            
            // Draw text from right edge (RTL)
            canvas.drawText(line, width - padding, currentY, activePaint);
            currentY += lineHeight;
        }
        
        android.util.Log.i("LuqmaPOS", "🖼️ Beautiful RTL receipt created!");
        
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
         * Print text receipt silently (no dialog)
         * @param text Receipt text content
         * @return "success" or error message
         */
        @JavascriptInterface
        public String printText(String text) {
            try {
                if (printer == null || printerHandle == null || Pointer.nativeValue(printerHandle) == 0) {
                    return "error: printer not initialized";
                }
                
                android.util.Log.i("LuqmaPOS", "📝 Printing order SILENTLY...");
                
                // Build full receipt with Windows-1256 for Arabic
                android.util.Log.i("LuqmaPOS", "🖼️ Printing beautiful order receipt with logo & Arabic");
                
                // Build clean receipt without manual separators (handled by createTextBitmap)
                String fullText = text + 
                        "\n\n" +
                        getString(R.string.receipt_thank_you_en) + " " + getBrandName() + "\n" +
                        getString(R.string.receipt_thank_you_ar) + " " + getString(R.string.brand_name_ar_short);
                
                android.util.Log.i("LuqmaPOS", "📝 Receipt length: " + fullText.length() + " chars");
                
                // Create beautiful bitmap with header/logo
                String[] lines = fullText.split("\n");
                Bitmap receiptBitmap = createTextBitmap(lines, true);
                
                android.util.Log.i("LuqmaPOS", "🖼️ Beautiful receipt bitmap: " + receiptBitmap.getWidth() + "x" + receiptBitmap.getHeight());
                
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
                
                android.util.Log.i("LuqmaPOS", "🖼️ Beautiful receipt printed: " + success);
                
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
                android.util.Log.e("LuqmaPOS", "❌ Print error: " + e.getMessage());
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
                
                android.util.Log.i("LuqmaPOS", "🧪 Test print with beautiful formatting");
                
                // Clean test receipt (header/logo added by createTextBitmap)
                String testText = "اختبار الطباعة - Test Print\n" +
                        "---\n" +
                        "الجهاز: H10 Terminal\n" +
                        "التطبيق: Luqma POS\n" +
                        "الحالة: متصل بنجاح\n" +
                        "\n" +
                        "--- اختبار النصوص ---\n" +
                        "إنجليزي: ABCDEFGH 1234\n" +
                        "عربي: لقمة طباعة اختبار\n" +
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
                
                android.util.Log.i("LuqmaPOS", "🖼️ Printing beautiful receipt with logo & Arabic...");
                
                // Split into lines
                String[] lines = testText.split("\n");
                android.util.Log.i("LuqmaPOS", "🖼️ Split into " + lines.length + " lines");
                
                // Create beautiful bitmap with header/logo (Android renders Arabic correctly!)
                Bitmap textBitmap = createTextBitmap(lines, true);
                
                android.util.Log.i("LuqmaPOS", "🖼️ Bitmap size: " + textBitmap.getWidth() + "x" + textBitmap.getHeight());
                
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
                
                android.util.Log.i("LuqmaPOS", "🖼️ Beautiful receipt printed: " + success);
                
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
                android.util.Log.e("LuqmaPOS", "❌ Error: " + e.getMessage());
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

