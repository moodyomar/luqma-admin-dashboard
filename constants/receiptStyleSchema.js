/**
 * Single source of truth for receipt style.
 * Used by: ReceiptStylePage (UI + save to Firestore), OrdersPage (pass to print),
 *          Android MainActivity (parse and apply layout-related fields as needed).
 * When adding a field: add here, add UI in ReceiptStylePage, add parse + use in MainActivity.java.
 */

export const RECEIPT_STYLE_KEYS = [
  'bodyFont',
  'lineHeight',
  'padding',
  'headerFont',
  'totalFont',
  'brandFont',
  'brandArFont',
  'footerFont',
  'sepMargin',
  'emptyGap',
  'logoMaxWidth',
  'logoSpacingAfter',
  'fontFamily',
  'footerTextEn',
  'footerTextAr',
  'titlesBoldOnly',
  /** When true, POS text receipt prints products before customer + delivery sections. */
  'customerAfterProducts',
];

/** Default values — numeric/font fields should stay aligned with MainActivity.java defaults where applicable */
export const DEFAULT_RECEIPT_STYLE = Object.freeze({
  bodyFont: 22,
  lineHeight: 32,
  padding: 15,
  headerFont: 25,
  totalFont: 26,
  brandFont: 36,
  brandArFont: 28,
  footerFont: 20,
  sepMargin: 15,
  emptyGap: 12,
  logoMaxWidth: 150,
  logoSpacingAfter: 25,
  fontFamily: "'Tahoma', 'Arial', sans-serif",
  footerTextEn: 'Thank you for using {brandName} App',
  footerTextAr: 'شكراً لاستخدامكم تطبيق {brandName}',
  /** When true, only section headers and item titles are bold; body/quantity/extras use normal weight. */
  titlesBoldOnly: false,
  /** When true: «تفاصيل المنتجات» أولاً ثم «معلومات العميل» و«تفاصيل التوصيل». */
  customerAfterProducts: false,
});

/** Min/max for numeric fields (clamped in Java too) — used for sliders and validation */
export const RECEIPT_STYLE_BOUNDS = Object.freeze({
  bodyFont: { min: 14, max: 36 },
  lineHeight: { min: 16, max: 48 },
  padding: { min: 6, max: 40 },
  headerFont: { min: 14, max: 40 },
  totalFont: { min: 16, max: 42 },
  brandFont: { min: 20, max: 56 },
  brandArFont: { min: 16, max: 48 },
  footerFont: { min: 14, max: 28 },
  sepMargin: { min: 8, max: 32 },
  emptyGap: { min: 4, max: 28 },
  logoMaxWidth: { min: 80, max: 280 },
  logoSpacingAfter: { min: 8, max: 48 },
});

/** Control config for ReceiptStylePage sliders (label + key + bounds) */
export const RECEIPT_STYLE_CONTROLS = [
  { key: 'bodyFont', label: 'خط الجسم (px)' },
  { key: 'lineHeight', label: 'ارتفاع السطر (px)' },
  { key: 'padding', label: 'الهوامش الداخلية (px)' },
  { key: 'headerFont', label: 'خط العناوين (px)' },
  { key: 'totalFont', label: 'خط الإجمالي (px)' },
  { key: 'brandFont', label: 'خط العلامة EN (px)' },
  { key: 'brandArFont', label: 'خط العلامة AR (px)' },
  { key: 'footerFont', label: 'خط التذييل (px)' },
  { key: 'sepMargin', label: 'مسافة الفاصل (px)' },
  { key: 'emptyGap', label: 'مسافة الأسطر الفارغة (px)' },
  { key: 'logoMaxWidth', label: 'عرض الشعار (px)' },
  { key: 'logoSpacingAfter', label: 'مسافة تحت الشعار (px)' },
].map(({ key, label }) => ({
  key,
  label,
  min: RECEIPT_STYLE_BOUNDS[key]?.min ?? 0,
  max: RECEIPT_STYLE_BOUNDS[key]?.max ?? 100,
}));

export const FONT_OPTIONS = Object.freeze([
  { value: "'Tahoma', 'Arial', sans-serif", label: 'Sans-serif (مطابق للطابعة)' },
  { value: "system-ui, sans-serif", label: 'System UI' },
  { value: "'Arial', sans-serif", label: 'Arial' },
  { value: "'Cairo', 'Tahoma', sans-serif", label: 'Cairo' },
]);

/** Build style object with defaults; safe for Firestore and for JSON to Java */
export function getDefaultReceiptStyle() {
  return { ...DEFAULT_RECEIPT_STYLE };
}

/** Merge saved style with defaults so new keys get default values */
export function mergeWithDefaults(saved) {
  if (!saved || typeof saved !== 'object') return getDefaultReceiptStyle();
  return { ...getDefaultReceiptStyle(), ...saved };
}
