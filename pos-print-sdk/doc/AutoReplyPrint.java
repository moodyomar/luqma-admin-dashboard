package com.caysn.autoreplyprint;

import android.graphics.Bitmap;

import java.io.ByteArrayOutputStream;

import com.sun.jna.Callback;
import com.sun.jna.Library;
import com.sun.jna.Native;
import com.sun.jna.Platform;
import com.sun.jna.Pointer;
import com.sun.jna.WString;
import com.sun.jna.ptr.DoubleByReference;
import com.sun.jna.ptr.IntByReference;
import com.sun.jna.ptr.LongByReference;

public interface AutoReplyPrint extends Library {

    // static interface method need jdk1.8. here we use inner class to avoid this porblem.
    class GetLibraryPath_Helper {
        // can replaced by absolute path
        public static String GetLibraryPath() {
            // force call JNI_OnLoad
            if (Platform.isAndroid())
                System.loadLibrary("autoreplyprint");
            return "autoreplyprint";
        }
    }

    public static final AutoReplyPrint INSTANCE = (AutoReplyPrint) Native.loadLibrary(GetLibraryPath_Helper.GetLibraryPath(), AutoReplyPrint.class);

    public static final int CP_ComDataBits_4 = 4;
    public static final int CP_ComDataBits_5 = 5;
    public static final int CP_ComDataBits_6 = 6;
    public static final int CP_ComDataBits_7 = 7;
    public static final int CP_ComDataBits_8 = 8;

    public static final int CP_ComParity_NoParity = 0;
    public static final int CP_ComParity_OddParity = 1;
    public static final int CP_ComParity_EvenParity = 2;
    public static final int CP_ComParity_MarkParity = 3;
    public static final int CP_ComParity_SpaceParity = 4;

    public static final int CP_ComStopBits_One = 0;
    public static final int CP_ComStopBits_OnePointFive = 1;
    public static final int CP_ComStopBits_Two = 2;

    public static final int CP_ComFlowControl_None = 0;
    public static final int CP_ComFlowControl_XonXoff = 1;
    public static final int CP_ComFlowControl_RtsCts = 2;
    public static final int CP_ComFlowControl_DtrDsr = 3;

    public static final int CP_CharacterSet_USA = 0;
    public static final int CP_CharacterSet_FRANCE = 1;
    public static final int CP_CharacterSet_GERMANY = 2;
    public static final int CP_CharacterSet_UK = 3;
    public static final int CP_CharacterSet_DENMARK_I = 4;
    public static final int CP_CharacterSet_SWEDEN = 5;
    public static final int CP_CharacterSet_ITALY = 6;
    public static final int CP_CharacterSet_SPAIN_I = 7;
    public static final int CP_CharacterSet_JAPAN = 8;
    public static final int CP_CharacterSet_NORWAY = 9;
    public static final int CP_CharacterSet_DENMARK_II = 10;
    public static final int CP_CharacterSet_SPAIN_II = 11;
    public static final int CP_CharacterSet_LATIN = 12;
    public static final int CP_CharacterSet_KOREA = 13;
    public static final int CP_CharacterSet_SLOVENIA = 14;
    public static final int CP_CharacterSet_CHINA = 15;

    public static final int CP_CharacterCodepage_CP437 = 0;
    public static final int CP_CharacterCodepage_KATAKANA = 1;
    public static final int CP_CharacterCodepage_CP850 = 2;
    public static final int CP_CharacterCodepage_CP860 = 3;
    public static final int CP_CharacterCodepage_CP863 = 4;
    public static final int CP_CharacterCodepage_CP865 = 5;
    public static final int CP_CharacterCodepage_WCP1251 = 6;
    public static final int CP_CharacterCodepage_CP866 = 7;
    public static final int CP_CharacterCodepage_MIK = 8;
    public static final int CP_CharacterCodepage_CP755 = 9;
    public static final int CP_CharacterCodepage_IRAN = 10;
    public static final int CP_CharacterCodepage_CP862 = 15;
    public static final int CP_CharacterCodepage_WCP1252 = 16;
    public static final int CP_CharacterCodepage_WCP1253 = 17;
    public static final int CP_CharacterCodepage_CP852 = 18;
    public static final int CP_CharacterCodepage_CP858 = 19;
    public static final int CP_CharacterCodepage_IRAN_II = 20;
    public static final int CP_CharacterCodepage_LATVIAN = 21;
    public static final int CP_CharacterCodepage_CP864 = 22;
    public static final int CP_CharacterCodepage_ISO_8859_1 = 23;
    public static final int CP_CharacterCodepage_CP737 = 24;
    public static final int CP_CharacterCodepage_WCP1257 = 25;
    public static final int CP_CharacterCodepage_THAI = 26;
    public static final int CP_CharacterCodepage_CP720 = 27;
    public static final int CP_CharacterCodepage_CP855 = 28;
    public static final int CP_CharacterCodepage_CP857 = 29;
    public static final int CP_CharacterCodepage_WCP1250 = 30;
    public static final int CP_CharacterCodepage_CP775 = 31;
    public static final int CP_CharacterCodepage_WCP1254 = 32;
    public static final int CP_CharacterCodepage_WCP1255 = 33;
    public static final int CP_CharacterCodepage_WCP1256 = 34;
    public static final int CP_CharacterCodepage_WCP1258 = 35;
    public static final int CP_CharacterCodepage_ISO_8859_2 = 36;
    public static final int CP_CharacterCodepage_ISO_8859_3 = 37;
    public static final int CP_CharacterCodepage_ISO_8859_4 = 38;
    public static final int CP_CharacterCodepage_ISO_8859_5 = 39;
    public static final int CP_CharacterCodepage_ISO_8859_6 = 40;
    public static final int CP_CharacterCodepage_ISO_8859_7 = 41;
    public static final int CP_CharacterCodepage_ISO_8859_8 = 42;
    public static final int CP_CharacterCodepage_ISO_8859_9 = 43;
    public static final int CP_CharacterCodepage_ISO_8859_15 = 44;
    public static final int CP_CharacterCodepage_THAI_2 = 45;
    public static final int CP_CharacterCodepage_CP856 = 46;
    public static final int CP_CharacterCodepage_CP874 = 47;
    public static final int CP_CharacterCodepage_TCVN3 = 48;

    public static final int CP_MultiByteEncoding_GBK = 0;
    public static final int CP_MultiByteEncoding_UTF8 = 1;
    public static final int CP_MultiByteEncoding_BIG5 = 3;
    public static final int CP_MultiByteEncoding_ShiftJIS = 4;
    public static final int CP_MultiByteEncoding_EUCKR = 5;

    public static final int CP_ImageBinarizationMethod_Dithering = 0;
    public static final int CP_ImageBinarizationMethod_Thresholding = 1;

    public static final int CP_ImageCompressionMethod_None = 0;
    public static final int CP_ImageCompressionMethod_Level1 = 1;
    public static final int CP_ImageCompressionMethod_Level2 = 2;

    public static final int CP_ImagePixelsFormat_MONO = 1;
    public static final int CP_ImagePixelsFormat_MONOLSB = 2;
    public static final int CP_ImagePixelsFormat_GRAY8 = 3;
    public static final int CP_ImagePixelsFormat_BYTEORDERED_RGB24 = 4;
    public static final int CP_ImagePixelsFormat_BYTEORDERED_BGR24 = 5;
    public static final int CP_ImagePixelsFormat_BYTEORDERED_ARGB32 = 6;
    public static final int CP_ImagePixelsFormat_BYTEORDERED_RGBA32 = 7;
    public static final int CP_ImagePixelsFormat_BYTEORDERED_ABGR32 = 8;
    public static final int CP_ImagePixelsFormat_BYTEORDERED_BGRA32 = 9;

    public static final int CP_QRCodeECC_L = 1;
    public static final int CP_QRCodeECC_M = 2;
    public static final int CP_QRCodeECC_Q = 3;
    public static final int CP_QRCodeECC_H = 4;

    public static final int CP_Pos_Alignment_Left = 0;
    public static final int CP_Pos_Alignment_HCenter = 1;
    public static final int CP_Pos_Alignment_Right = 2;

    public static final int CP_Pos_BarcodeType_UPCA = 0x41;
    public static final int CP_Pos_BarcodeType_UPCE = 0x42;
    public static final int CP_Pos_BarcodeType_EAN13 = 0x43;
    public static final int CP_Pos_BarcodeType_EAN8 = 0x44;
    public static final int CP_Pos_BarcodeType_CODE39 = 0x45;
    public static final int CP_Pos_BarcodeType_ITF = 0x46;
    public static final int CP_Pos_BarcodeType_CODEBAR = 0x47;
    public static final int CP_Pos_BarcodeType_CODE93 = 0x48;
    public static final int CP_Pos_BarcodeType_CODE128 = 0x49;

    public static final int CP_Pos_BarcodeTextPrintPosition_None = 0;
    public static final int CP_Pos_BarcodeTextPrintPosition_AboveBarcode = 1;
    public static final int CP_Pos_BarcodeTextPrintPosition_BelowBarcode = 2;
    public static final int CP_Pos_BarcodeTextPrintPosition_AboveAndBelowBarcode = 3;

    public static final int CP_Page_DrawDirection_LeftToRight = 0;
    public static final int CP_Page_DrawDirection_BottomToTop = 1;
    public static final int CP_Page_DrawDirection_RightToLeft = 2;
    public static final int CP_Page_DrawDirection_TopToBottom = 3;

    public static final int CP_Page_DrawAlignment_Left = -1;
    public static final int CP_Page_DrawAlignment_HCenter = -2;
    public static final int CP_Page_DrawAlignment_Right = -3;
    public static final int CP_Page_DrawAlignment_Top = -1;
    public static final int CP_Page_DrawAlignment_VCenter = -2;
    public static final int CP_Page_DrawAlignment_Bottom = -3;

    public static final int CP_Label_BarcodeType_UPCA = 0;
    public static final int CP_Label_BarcodeType_UPCE = 1;
    public static final int CP_Label_BarcodeType_EAN13 = 2;
    public static final int CP_Label_BarcodeType_EAN8 = 3;
    public static final int CP_Label_BarcodeType_CODE39 = 4;
    public static final int CP_Label_BarcodeType_ITF = 5;
    public static final int CP_Label_BarcodeType_CODEBAR = 6;
    public static final int CP_Label_BarcodeType_CODE93 = 7;
    public static final int CP_Label_BarcodeType_CODE128 = 8;
    public static final int CP_Label_BarcodeType_CODE11 = 9;
    public static final int CP_Label_BarcodeType_MSI = 10;
    public static final int CP_Label_BarcodeType_128M = 11;
    public static final int CP_Label_BarcodeType_EAN128 = 12;
    public static final int CP_Label_BarcodeType_25C = 13;
    public static final int CP_Label_BarcodeType_39C = 14;
    public static final int CP_Label_BarcodeType_39 = 15;
    public static final int CP_Label_BarcodeType_EAN13PLUS2 = 16;
    public static final int CP_Label_BarcodeType_EAN13PLUS5 = 17;
    public static final int CP_Label_BarcodeType_EAN8PLUS2 = 18;
    public static final int CP_Label_BarcodeType_EAN8PLUS5 = 19;
    public static final int CP_Label_BarcodeType_POST = 20;
    public static final int CP_Label_BarcodeType_UPCAPLUS2 = 21;
    public static final int CP_Label_BarcodeType_UPCAPLUS5 = 22;
    public static final int CP_Label_BarcodeType_UPCEPLUS2 = 23;
    public static final int CP_Label_BarcodeType_UPCEPLUS5 = 24;
    public static final int CP_Label_BarcodeType_CPOST = 25;
    public static final int CP_Label_BarcodeType_MSIC = 26;
    public static final int CP_Label_BarcodeType_PLESSEY = 27;
    public static final int CP_Label_BarcodeType_ITF14 = 28;
    public static final int CP_Label_BarcodeType_EAN14 = 29;

    public static final int CP_Label_BarcodeTextPrintPosition_None = 0;
    public static final int CP_Label_BarcodeTextPrintPosition_AboveBarcode = 1;
    public static final int CP_Label_BarcodeTextPrintPosition_BelowBarcode = 2;
    public static final int CP_Label_BarcodeTextPrintPosition_AboveAndBelowBarcode = 3;

    public static final int CP_Label_Rotation_0 = 0;
    public static final int CP_Label_Rotation_90 = 1;
    public static final int CP_Label_Rotation_180 = 2;
    public static final int CP_Label_Rotation_270 = 3;

    public static final int CP_Label_Color_White = 0;
    public static final int CP_Label_Color_Black = 1;

    public class CP_PrinterStatus {

        private long error_status = 0;
        private long info_status = 0;

        public CP_PrinterStatus(long error_status, long info_status) {
            this.error_status = error_status;
            this.info_status = info_status;
        }
        
        public long errorStatus() {
            return error_status;
        }
        
        public long infoStatus() {
            return info_status;
        }

        public boolean ERROR_OCCURED() {
            return error_status != 0;
        }

        public boolean ERROR_CUTTER() {
            return (error_status & 0x01) != 0;
        }

        public boolean ERROR_FLASH() {
            return (error_status & 0x02) != 0;
        }

        public boolean ERROR_NOPAPER() {
            return (error_status & 0x04) != 0;
        }

        public boolean ERROR_VOLTAGE() {
            return (error_status & 0x08) != 0;
        }

        public boolean ERROR_MARKER() {
            return (error_status & 0x10) != 0;
        }

        public boolean ERROR_ENGINE() {
            return (error_status & 0x20) != 0;
        }

        public boolean ERROR_OVERHEAT() {
            return (error_status & 0x40) != 0;
        }

        public boolean ERROR_COVERUP() {
            return (error_status & 0x80) != 0;
        }
        
        public boolean ERROR_MOTOR() {
            return (error_status & 0x100) != 0;
        }

        public boolean INFO_LABELPAPER() {
            return (info_status & 0x02) != 0;
        }

        public boolean INFO_LABELMODE() {
            return (info_status & 0x04) != 0;
        }

        public boolean INFO_HAVEDATA() {
            return (info_status & 0x08) != 0;
        }

        public boolean INFO_NOPAPERCANCELED() {
            return (info_status & 0x10) != 0;
        }

        public boolean INFO_PAPERNOFETCH() {
            return (info_status & 0x20) != 0;
        }

        public boolean INFO_PRINTIDLE() {
            return (info_status & 0x40) != 0;
        }

        public boolean INFO_RECVIDLE() {
            return (info_status & 0x80) != 0;
        }
    }

    public class CP_RTSTATUS_Helper {
        public static boolean CP_RTSTATUS_DRAWER_OPENED(long status) { return (((status >> 0) & 0x04) == 0x00); };
        public static boolean CP_RTSTATUS_OFFLINE(long status) { return (((status >> 0) & 0x08) == 0x08); };
        public static boolean CP_RTSTATUS_COVERUP(long status) { return (((status >> 8) & 0x04) == 0x04); };
        public static boolean CP_RTSTATUS_FEED_PRESSED(long status) { return (((status >> 8) & 0x08) == 0x08); };
        public static boolean CP_RTSTATUS_NOPAPER(long status) { return (((status >> 8) & 0x20) == 0x20); };
        public static boolean CP_RTSTATUS_ERROR_OCCURED(long status) { return (((status >> 8) & 0x40) == 0x40); };
        public static boolean CP_RTSTATUS_CUTTER_ERROR(long status) { return (((status >> 16) & 0x08) == 0x08); };
        public static boolean CP_RTSTATUS_UNRECOVERABLE_ERROR(long status) { return (((status >> 16) & 0x20) == 0x20); };
        public static boolean CP_RTSTATUS_DEGREE_OR_VOLTAGE_OVERRANGE(long status) { return (((status >> 16) & 0x40) == 0x40); };
        public static boolean CP_RTSTATUS_PAPER_NEAREND(long status) { return (((status >> 24) & 0x0C) == 0x0C); };
        public static boolean CP_RTSTATUS_PAPER_TAKEOUT(long status) { return (((status >> 24) & 0x04) == 0x04); };
    }

    public class CP_Label_TextStyle {

        private int style = 0;

        public CP_Label_TextStyle(boolean bold, boolean underline, boolean highlight, boolean strikethrough, int rotation, int widthscale, int heightscale) {
            int style = 0;
            if (bold)
                style |= (1 << 0);
            if (underline)
                style |= (1 << 1);
            if (highlight)
                style |= (1 << 2);
            if (strikethrough)
                style |= (1 << 3);
            style |= (rotation << 4);
            style |= (widthscale << 8);
            style |= (heightscale << 12);
            this.style = style;
        }

        public int getStyle() {
            return style;
        }
    }

    public interface CP_OnNetPrinterDiscovered_Callback extends Callback {
        void CP_OnNetPrinterDiscovered(String local_ip, String discovered_mac, String discovered_ip, String discovered_name, Pointer private_data);
    }

    public interface CP_OnBluetoothDeviceDiscovered_Callback extends Callback {
        void CP_OnBluetoothDeviceDiscovered(String device_name, String device_address, Pointer private_data);
    }

    public interface CP_OnPortOpenedEvent_Callback extends Callback {
        void CP_OnPortOpenedEvent(Pointer handle, String name, Pointer private_data);
    }

    public interface CP_OnPortOpenFailedEvent_Callback extends Callback {
        void CP_OnPortOpenFailedEvent(Pointer handle, String name, Pointer private_data);
    }

    public interface CP_OnPortClosedEvent_Callback extends Callback {
        void CP_OnPortClosedEvent(Pointer handle, Pointer private_data);
    }

    public interface CP_OnPrinterStatusEvent_Callback extends Callback {
        void CP_OnPrinterStatusEvent(Pointer handle, long printer_error_status, long printer_info_status, Pointer private_data);
    }

    public interface CP_OnPrinterReceivedEvent_Callback extends Callback {
        void CP_OnPrinterReceivedEvent(Pointer handle, int printer_received_byte_count, Pointer private_data);
    }

    public interface CP_OnPrinterPrintedEvent_Callback extends Callback {
        void CP_OnPrinterPrintedEvent(Pointer handle, int printer_printed_page_id, Pointer private_data);
    }

    public String CP_Library_Version();

    public int CP_Port_EnumCom(byte[] pBuf, int cbBuf, IntByReference pcbNeeded);

    public class CP_Port_EnumCom_Helper {
        public static String[] EnumCom() {
            try {
                return new SerialPortFinder().getAllDevicesPath();
            } catch (Throwable tr) {
                tr.printStackTrace();
            }
            return null;
        }
    }

    public int CP_Port_EnumUsb(byte[] pBuf, int cbBuf, IntByReference pcbNeeded);

    public class CP_Port_EnumUsb_Helper {
        public static String[] EnumUsb() {
            IntByReference pcbNeeded = new IntByReference();
            INSTANCE.CP_Port_EnumUsb(null, 0, pcbNeeded);
            if (pcbNeeded.getValue() > 0) {
                byte[] pBuf = new byte[pcbNeeded.getValue()];
                if (pBuf != null) {
                    INSTANCE.CP_Port_EnumUsb(pBuf, pBuf.length, null);
                    String s = new String(pBuf);
                    String[] ss = s.split("\0");
                    return ss;
                }
            }
            return null;
        }
    }

    public void CP_Port_EnumNetPrinter(int timeout, IntByReference cancel, CP_OnNetPrinterDiscovered_Callback on_discovered, Pointer data);

    public void CP_Port_EnumBtDevice(int timeout, IntByReference cancel, CP_OnBluetoothDeviceDiscovered_Callback on_discovered, Pointer data);

    public void CP_Port_EnumBleDevice(int timeout, IntByReference cancel, CP_OnBluetoothDeviceDiscovered_Callback on_discovered, Pointer data);

    public Pointer CP_Port_OpenCom(String name, int baudrate, int databits, int parity, int stopbits, int flowcontrol, int autoreplymode);

    public Pointer CP_Port_OpenUsb(String name, int autoreplymode);

    public Pointer CP_Port_OpenTcp(String local_ip, String dest_ip, short dest_port, int timeout, int autoreplymode);

    public Pointer CP_Port_OpenBtSpp(String address, int autoreplymode);

    public Pointer CP_Port_OpenBtBle(String address, int autoreplymode);

    public int CP_Port_Write(Pointer handle, byte[] buffer, int count, int timeout);

    public int CP_Port_Read(Pointer handle, byte[] buffer, int count, int timeout);

    public int CP_Port_ReadUntilByte(Pointer handle, byte[] buffer, int count, int timeout, byte breakByte);

    public int CP_Port_Available(Pointer handle);

    public boolean CP_Port_SkipAvailable(Pointer handle);

    public boolean CP_Port_IsConnectionValid(Pointer handle);

    public boolean CP_Port_IsOpened(Pointer handle);

    public boolean CP_Port_Close(Pointer handle);

    public boolean CP_Port_AddOnPortOpenedEvent(CP_OnPortOpenedEvent_Callback event, Pointer private_data);

    public boolean CP_Port_AddOnPortOpenFailedEvent(CP_OnPortOpenFailedEvent_Callback event, Pointer private_data);

    public boolean CP_Port_AddOnPortClosedEvent(CP_OnPortClosedEvent_Callback event, Pointer private_data);

    public boolean CP_Port_RemoveOnPortOpenedEvent(CP_OnPortOpenedEvent_Callback event);

    public boolean CP_Port_RemoveOnPortOpenFailedEvent(CP_OnPortOpenFailedEvent_Callback event);

    public boolean CP_Port_RemoveOnPortClosedEvent(CP_OnPortClosedEvent_Callback event);

    public boolean CP_Printer_AddOnPrinterStatusEvent(CP_OnPrinterStatusEvent_Callback event, Pointer private_data);

    public boolean CP_Printer_AddOnPrinterReceivedEvent(CP_OnPrinterReceivedEvent_Callback event, Pointer private_data);

    public boolean CP_Printer_AddOnPrinterPrintedEvent(CP_OnPrinterPrintedEvent_Callback event, Pointer private_data);

    public boolean CP_Printer_RemoveOnPrinterStatusEvent(CP_OnPrinterStatusEvent_Callback event);

    public boolean CP_Printer_RemoveOnPrinterReceivedEvent(CP_OnPrinterReceivedEvent_Callback event);

    public boolean CP_Printer_RemoveOnPrinterPrintedEvent(CP_OnPrinterPrintedEvent_Callback event);

    public boolean CP_Printer_GetPrinterResolutionInfo(Pointer handle, IntByReference width_mm, IntByReference height_mm, IntByReference dots_per_mm);

    public boolean CP_Printer_GetPrinterFirmwareVersion(Pointer handle, byte[] pBuf, int cbBuf, IntByReference pcbNeeded);

    public class CP_Printer_GetPrinterFirmwareVersion_Helper {
        public static String GetPrinterFirmwareVersion(Pointer handle) {
            IntByReference pcbNeeded = new IntByReference();
            INSTANCE.CP_Printer_GetPrinterFirmwareVersion(handle, null, 0, pcbNeeded);
            if (pcbNeeded.getValue() > 0) {
                byte[] pBuf = new byte[pcbNeeded.getValue()];
                if (pBuf != null) {
                    INSTANCE.CP_Printer_GetPrinterFirmwareVersion(handle, pBuf, pBuf.length, null);
                    String s = new String(pBuf);
                    return s;
                }
            }
            return null;
        }
    }

    public boolean CP_Printer_GetPrinterStatusInfo(Pointer handle, LongByReference printer_error_status, LongByReference printer_info_status, LongByReference timestamp_ms);

    public boolean CP_Printer_GetPrinterReceivedInfo(Pointer handle, IntByReference printer_received_byte_count, LongByReference timestamp_ms);

    public boolean CP_Printer_GetPrinterPrintedInfo(Pointer handle, IntByReference printer_printed_page_id, LongByReference timestamp_ms);

    public boolean CP_Printer_GetPrinterLabelPositionAdjustmentInfo(Pointer handle, DoubleByReference label_print_position_adjustment, DoubleByReference label_tear_position_adjustment, LongByReference timestamp_ms);

    public boolean CP_Printer_SetPrinterLabelPositionAdjustmentInfo(Pointer handle, double label_print_position_adjustment, double label_tear_position_adjustment);

    public boolean CP_Printer_ClearPrinterBuffer(Pointer handle);

    public boolean CP_Printer_ClearPrinterError(Pointer handle);

    public int CP_Pos_QueryRTStatus(Pointer handle, int timeout);

    public boolean CP_Pos_QueryPrintResult(Pointer handle, int nPageID, int timeout);

    public boolean CP_Pos_KickOutDrawer(Pointer handle, int nDrawerIndex, int nHighLevelTime, int nLowLevelTime);

    public boolean CP_Pos_Beep(Pointer handle, int nBeepCount, int nBeepMs);

    public boolean CP_Pos_FeedAndHalfCutPaper(Pointer handle);

    public boolean CP_Pos_FullCutPaper(Pointer handle);

    public boolean CP_Pos_HalfCutPaper(Pointer handle);

    public boolean CP_Pos_FeedLine(Pointer handle, int numLines);

    public boolean CP_Pos_FeedDot(Pointer handle, int numDots);

    public boolean CP_Pos_PrintSelfTestPage(Pointer handle);

    public boolean CP_Pos_PrintText(Pointer handle, String str);

    public boolean CP_Pos_PrintTextInUTF8(Pointer handle, WString str);

    public boolean CP_Pos_PrintTextInGBK(Pointer handle, WString str);

    public boolean CP_Pos_PrintTextInBIG5(Pointer handle, WString str);

    public boolean CP_Pos_PrintTextInShiftJIS(Pointer handle, WString str);

    public boolean CP_Pos_PrintTextInEUCKR(Pointer handle, WString str);

    public boolean CP_Pos_PrintBarcode(Pointer handle, int nBarcodeType, String str);

    public boolean CP_Pos_PrintQRCode(Pointer handle, int nVersion, int nECCLevel, String str);

    public boolean CP_Pos_PrintQRCodeUseEpsonCmd(Pointer handle, int nQRCodeUnitWidth, int nECCLevel, String str);

    public boolean CP_Pos_PrintDoubleQRCode(Pointer handle, int nQRCodeUnitWidth, int nQR1Position, int nQR1Version, int nQR1ECCLevel, String strQR1, int nQR2Position, int nQR2Version, int nQR2ECCLevel, String strQR2);

    public boolean CP_Pos_PrintPDF417BarcodeUseEpsonCmd(Pointer handle, int columnCount, int rowCount, int unitWidth, int rowHeight, int nECCLevel, int dataProcessingMode, String str);

    public boolean CP_Pos_PrintRasterImageFromFile(Pointer handle, int dstw, int dsth, String pszFile, int binaryzation_method, int compress_method);

    public boolean CP_Pos_PrintRasterImageFromData(Pointer handle, int dstw, int dsth, byte[] data, int data_size, int binaryzation_method, int compress_method);
    public class CP_Pos_PrintRasterImageFromData_Helper {
        public static boolean PrintRasterImageFromBitmap(Pointer handle, int dstw, int dsth, Bitmap bitmap, int binaryzation_method, int compress_method) {
            boolean result = false;
            ByteArrayOutputStream os = new ByteArrayOutputStream();
            if (bitmap.compress(Bitmap.CompressFormat.PNG, 100, os)) {
                byte[] data = os.toByteArray();
                result = INSTANCE.CP_Pos_PrintRasterImageFromData(handle, dstw, dsth, data, data.length, binaryzation_method, compress_method);
            }
            return result;
        }
    }

    public boolean CP_Pos_PrintRasterImageFromPixels(Pointer handle, byte[] img_data, int img_datalen, int img_width, int img_height, int img_stride, int img_format, int binaryzation_method, int compress_method);

    public boolean CP_Pos_PrintHorizontalLine(Pointer handle, int nLineStartPosition, int nLineEndPosition);

    public boolean CP_Pos_PrintHorizontalLineSpecifyThickness(Pointer handle, int nLineStartPosition, int nLineEndPosition, int nLineThickness);

    public boolean CP_Pos_PrintMultipleHorizontalLinesAtOneRow(Pointer handle, int nLineCount, int[] pLineStartPosition, int[] pLineEndPosition);

    public boolean CP_Pos_ResetPrinter(Pointer handle);

    public boolean CP_Pos_SetPrintSpeed(Pointer handle, int nSpeed);

    public boolean CP_Pos_SetPrintDensity(Pointer handle, int nDensity);

    public boolean CP_Pos_SetSingleByteMode(Pointer handle);

    public boolean CP_Pos_SetCharacterSet(Pointer handle, int nCharacterSet);

    public boolean CP_Pos_SetCharacterCodepage(Pointer handle, int nCharacterCodepage);

    public boolean CP_Pos_SetMultiByteMode(Pointer handle);

    public boolean CP_Pos_SetMultiByteEncoding(Pointer handle, int nEncoding);

    public boolean CP_Pos_SetMovementUnit(Pointer handle, int nHorizontalMovementUnit, int nVerticalMovementUnit);

    public boolean CP_Pos_SetPrintAreaLeftMargin(Pointer handle, int nLeftMargin);

    public boolean CP_Pos_SetPrintAreaWidth(Pointer handle, int nWidth);

    public boolean CP_Pos_SetHorizontalAbsolutePrintPosition(Pointer handle, int nPosition);

    public boolean CP_Pos_SetHorizontalRelativePrintPosition(Pointer handle, int nPosition);

    public boolean CP_Pos_SetVerticalAbsolutePrintPosition(Pointer handle, int nPosition);

    public boolean CP_Pos_SetVerticalRelativePrintPosition(Pointer handle, int nPosition);

    public boolean CP_Pos_SetAlignment(Pointer handle, int nAlignment);

    public boolean CP_Pos_SetTextScale(Pointer handle, int nWidthScale, int nHeightScale);

    public boolean CP_Pos_SetAsciiTextFontType(Pointer handle, int nFontType);

    public boolean CP_Pos_SetTextBold(Pointer handle, int nBold);

    public boolean CP_Pos_SetTextUnderline(Pointer handle, int nUnderline);

    public boolean CP_Pos_SetTextUpsideDown(Pointer handle, int nUpsideDown);

    public boolean CP_Pos_SetTextWhiteOnBlack(Pointer handle, int nWhiteOnBlack);

    public boolean CP_Pos_SetTextRotate(Pointer handle, int nRotate);

    public boolean CP_Pos_SetTextLineHeight(Pointer handle, int nLineHeight);

    public boolean CP_Pos_SetAsciiTextCharRightSpacing(Pointer handle, int nSpacing);

    public boolean CP_Pos_SetKanjiTextCharSpacing(Pointer handle, int nLeftSpacing, int nRightSpacing);

    public boolean CP_Pos_SetBarcodeUnitWidth(Pointer handle, int nBarcodeUnitWidth);

    public boolean CP_Pos_SetBarcodeHeight(Pointer handle, int nBarcodeHeight);

    public boolean CP_Pos_SetBarcodeReadableTextFontType(Pointer handle, int nFontType);

    public boolean CP_Pos_SetBarcodeReadableTextPosition(Pointer handle, int nTextPosition);

    public boolean CP_Page_SelectPageMode(Pointer handle);

    public boolean CP_Page_SelectPageModeEx(Pointer handle, int nHorizontalMovementUnit, int nVerticalMovementUnit, int x, int y, int width, int height);

    public boolean CP_Page_ExitPageMode(Pointer handle);

    public boolean CP_Page_PrintPage(Pointer handle);

    public boolean CP_Page_ClearPage(Pointer handle);

    public boolean CP_Page_SetPageArea(Pointer handle, int x, int y, int width, int height);

    public boolean CP_Page_SetPageDrawDirection(Pointer handle, int nDirection);

    public boolean CP_Page_DrawRect(Pointer handle, int x, int y, int width, int height, int color);

    public boolean CP_Page_DrawBox(Pointer handle, int x, int y, int width, int height, int borderwidth, int bordercolor);

    public boolean CP_Page_DrawText(Pointer handle, int x, int y, String str);

    public boolean CP_Page_DrawTextInUTF8(Pointer handle, int x, int y, WString str);

    public boolean CP_Page_DrawTextInGBK(Pointer handle, int x, int y, WString str);

    public boolean CP_Page_DrawTextInBIG5(Pointer handle, int x, int y, WString str);

    public boolean CP_Page_DrawTextInShiftJIS(Pointer handle, int x, int y, WString str);

    public boolean CP_Page_DrawTextInEUCKR(Pointer handle, int x, int y, WString str);

    public boolean CP_Page_DrawBarcode(Pointer handle, int x, int y, int nBarcodeType, String str);

    public boolean CP_Page_DrawQRCode(Pointer handle, int x, int y, int nVersion, int nECCLevel, String str);

    public boolean CP_Page_DrawRasterImageFromFile(Pointer handle, int x, int y, int dstw, int dsth, String pszFile, int binaryzation_method);

    public boolean CP_Page_DrawRasterImageFromData(Pointer handle, int x, int y, int dstw, int dsth, byte[] data, int data_size, int binaryzation_method);
    public class CP_Page_DrawRasterImageFromData_Helper {
        public static boolean DrawRasterImageFromBitmap(Pointer handle, int x, int y, int dstw, int dsth, Bitmap bitmap, int binaryzation_method) {
            boolean result = false;
            ByteArrayOutputStream os = new ByteArrayOutputStream();
            if (bitmap.compress(Bitmap.CompressFormat.PNG, 100, os)) {
                byte[] data = os.toByteArray();
                result = INSTANCE.CP_Page_DrawRasterImageFromData(handle, x, y, dstw, dsth, data, data.length, binaryzation_method);
            }
            return result;
        }
    }

    public boolean CP_Page_DrawRasterImageFromPixels(Pointer handle, int x, int y, byte[] img_data, int img_datalen, int img_width, int img_height, int img_stride, int img_format, int binaryzation_method);

    public boolean CP_BlackMark_EnableBlackMarkMode(Pointer handle);

    public boolean CP_BlackMark_DisableBlackMarkMode(Pointer handle);

    public boolean CP_BlackMark_SetBlackMarkMaxFindLength(Pointer handle, int maxFindLength);

    public boolean CP_BlackMark_FindNextBlackMark(Pointer handle);

    public boolean CP_BlackMark_SetBlackMarkPaperPrintPosition(Pointer handle, int position);

    public boolean CP_BlackMark_SetBlackMarkPaperCutPosition(Pointer handle, int position);

    public boolean CP_BlackMark_FullCutBlackMarkPaper(Pointer handle);

    public boolean CP_BlackMark_HalfCutBlackMarkPaper(Pointer handle);

    public boolean CP_Label_EnableLabelMode(Pointer handle);

    public boolean CP_Label_DisableLabelMode(Pointer handle);

    public boolean CP_Label_CalibrateLabel(Pointer handle);

    public boolean CP_Label_FeedLabel(Pointer handle);

    public boolean CP_Label_PageBegin(Pointer handle, int x, int y, int width, int height, int rotation);

    public boolean CP_Label_PagePrint(Pointer handle, int copies);

    public boolean CP_Label_DrawText(Pointer handle, int x, int y, int font, int style, String str);

    public boolean CP_Label_DrawTextInUTF8(Pointer handle, int x, int y, int font, int style, WString str);

    public boolean CP_Label_DrawTextInGBK(Pointer handle, int x, int y, int font, int style, WString str);

    public boolean CP_Label_DrawBarcode(Pointer handle, int x, int y, int nBarcodeType, int nBarcodeTextPrintPosition, int height, int unitwidth, int rotation, String str);

    public boolean CP_Label_DrawQRCode(Pointer handle, int x, int y, int nVersion, int nECCLevel, int unitwidth, int rotation, String str);

    public boolean CP_Label_DrawPDF417Code(Pointer handle, int x, int y, int column, int nAspectRatio, int nECCLevel, int unitwidth, int rotation, String str);

    public boolean CP_Label_DrawImageFromFile(Pointer handle, int x, int y, int dstw, int dsth, String pszFile, int binaryzation_method);

    public boolean CP_Label_DrawImageFromData(Pointer handle, int x, int y, int dstw, int dsth, byte[] data, int data_size, int binaryzation_method);

    public class CP_Label_DrawImageFromData_Helper {
        public static boolean DrawImageFromBitmap(Pointer handle, int x, int y, int dstw, int dsth, Bitmap bitmap, int binaryzation_method) {
            boolean result = false;
            ByteArrayOutputStream os = new ByteArrayOutputStream();
            if (bitmap.compress(Bitmap.CompressFormat.PNG, 100, os)) {
                byte[] data = os.toByteArray();
                result = INSTANCE.CP_Label_DrawImageFromData(handle, x, y, dstw, dsth, data, data.length, binaryzation_method);
            }
            return result;
        }
    }

    public boolean CP_Label_DrawImageFromPixels(Pointer handle, int x, int y, byte[] img_data, int img_datalen, int img_width, int img_height, int img_stride, int img_format, int binaryzation_method);

    public boolean CP_Label_DrawLine(Pointer handle, int startx, int starty, int endx, int endy, int linewidth, int linecolor);

    public boolean CP_Label_DrawRect(Pointer handle, int x, int y, int width, int height, int color);

    public boolean CP_Label_DrawBox(Pointer handle, int x, int y, int width, int height, int borderwidth, int bordercolor);

}

