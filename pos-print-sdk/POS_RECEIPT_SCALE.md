# POS receipt – scalable across all apps

Receipt style is **identical for all apps** and driven from Firebase (`config.receiptStyle`). Sync and update scripts never overwrite client-specific assets.

## Same style, no overwrites

- **Receipt style** (font, sizes, spacing, titles-bold-only) is synced from Luqma/template to all clients via `sync-template.sh` and `update-client.sh`. All apps share the same code and schema.
- **Logo**: Each business keeps its own receipt logo.  
  - **Sync** (luqma → template): excludes `pos-print-sdk/.../res/drawable`.  
  - **Update** (template → client): preserves and restores `pos-print-sdk/.../res/drawable` so the client’s logo is never replaced.
- **Sounds**: Same file names in every app (`new-order-arrived.mp3`, `order-not-accepted-yet.mp3`, `future-order-due.mp3`). `sync-template.sh` excludes `public/*.mp3` and `public/**/*.mp3`. **`update-client.sh`** should merge `rsync-client-preserved-assets.filter` so `--delete` does not strip a client’s `public/*.mp3` when the template has no copy.
- **Web receipt logo**: `public/receipt_logo.png` (and `public/receipt*.png`) are excluded from luqma→template sync and listed in **`rsync-client-preserved-assets.filter`** for template→client updates. Android drawable logo stays excluded via `pos-print-sdk/.../drawable` as before.

## Preview = print

- **Receipt Style page** (شكل الإيصال) in the dashboard shows a live preview that matches the POS print (Java): same structure, same separators, same font/sizes. When you save, the next print uses that style.
- **ReceiptPreview.html** uses the same layout as the Receipt Style page and the Java bitmap so “what you see” matches “what prints”.
- Style is stored in Firestore (`config.receiptStyle`); the Android app reads it and applies it when building the receipt bitmap.

## Titles bold only

- In Receipt Style page, **عناوين فقط بولد (Titles bold only)** controls whether only titles are bold.
- When **on**: section headers (--- معلومات العميل ---, etc.) and item titles (1. سلطة الجزر) are bold; body lines (الاسم، الكمية، إضافات، ملاحظات) use normal weight.
- When **off**: entire receipt uses bold (previous behavior).
- Implemented in: `receiptStyleSchema.js` (`titlesBoldOnly`), `ReceiptStylePage.jsx` (checkbox + preview), `OrdersPage.jsx` `buildReceiptText` (prefix `\u200B` for non-title lines), and `MainActivity.java` (normal-weight paint for lines starting with `\u200B`).

## Java / Firebase

- **receiptStyleSchema.js** is the single source of truth for keys and defaults.
- **ReceiptStylePage** loads/saves `config.receiptStyle` in Firestore.
- **OrdersPage** passes `receiptStyle` and receipt text to `window.PosPrinter.printText(text, JSON.stringify(receiptStyle))`.
- **MainActivity.java** parses the JSON and applies font sizes, line height, padding, logo size, and `titlesBoldOnly` when drawing the receipt bitmap.
