// Luqma Admin Dashboard - fixed to Luqma only (no env/host overrides).
// Sound paths and delay are from env so sync/update scripts don't overwrite per-app voices.
const DEFAULT_NEW_ORDER_SOUND = '/luqma.mp3';
const DEFAULT_NOT_ACCEPTED_SOUND = '/order-not-accepted-yet.mp3';
const DEFAULT_FUTURE_DUE_SOUND = '/future-order-due.mp3';
const DEFAULT_NOT_ACCEPTED_AFTER_MS = 2 * 60 * 1000; // 2 minutes

const brandConfig = {
  id: 'luqma',
  name: 'Luqma',
  logoUrl: 'https://qbmedia.b-cdn.net/luqmaimages/logo.svg',
  themeColor: '#007aff',
  // 1) New order arrived (plays immediately). Set VITE_NEW_ORDER_SOUND in .env per app.
  notificationSound: import.meta.env.VITE_NEW_ORDER_SOUND || DEFAULT_NEW_ORDER_SOUND,
  // 2) Delay before "not accepted" reminder (ms). Set VITE_ORDER_NOT_ACCEPTED_AFTER_MS in .env.
  orderNotAcceptedAfterMs: Number(import.meta.env.VITE_ORDER_NOT_ACCEPTED_AFTER_MS) || DEFAULT_NOT_ACCEPTED_AFTER_MS,
  // 2) Order not accepted yet – personalized voice. Set VITE_ORDER_NOT_ACCEPTED_SOUND in .env per app.
  orderNotAcceptedSound: import.meta.env.VITE_ORDER_NOT_ACCEPTED_SOUND || DEFAULT_NOT_ACCEPTED_SOUND,
  // 3) Future order due – personalized voice. Set VITE_FUTURE_ORDER_DUE_SOUND in .env per app.
  futureOrderDueSound: import.meta.env.VITE_FUTURE_ORDER_DUE_SOUND || DEFAULT_FUTURE_DUE_SOUND,
  adminPassword: import.meta.env.VITE_ADMIN_PASSWORD || 'admin123',
};

export default brandConfig;