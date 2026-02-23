// Luqma Admin Dashboard - fixed to Luqma only (no env/host overrides).
const brandConfig = {
  id: 'luqma',
  name: 'Luqma',
  logoUrl: 'https://qbmedia.b-cdn.net/luqmaimages/logo.svg',
  themeColor: '#007aff',
  notificationSound: '/luqma.mp3',
  adminPassword: import.meta.env.VITE_ADMIN_PASSWORD || 'admin123',
};

export default brandConfig;