// Client-agnostic: set VITE_BRAND_* in .env (or init script) per client. No hardcoded brand.
// Luqma override: Luqma domain OR localhost → always Luqma (this repo is the Luqma admin dashboard).
const getBrandConfig = () => {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isLuqma =
    hostname.includes('luqma') || hostname === 'localhost' || hostname === '127.0.0.1';

  if (isLuqma) {
    return {
      id: 'luqma',
      name: 'Luqma',
      logoUrl: 'https://qbmedia.b-cdn.net/luqmaimages/logo.svg',
      themeColor: '#007aff',
      notificationSound: '/luqma.mp3',
      adminPassword: import.meta.env.VITE_ADMIN_PASSWORD || 'admin123',
    };
  }

  return {
    id: import.meta.env.VITE_BRAND_ID || 'your-brand',
    name: import.meta.env.VITE_BRAND_NAME || 'Your Brand',
    logoUrl: import.meta.env.VITE_BRAND_LOGO || '',
    themeColor: import.meta.env.VITE_BRAND_COLOR || '#007aff',
    notificationSound: import.meta.env.VITE_NOTIFICATION_SOUND || '/notification.mp3',
    adminPassword: import.meta.env.VITE_ADMIN_PASSWORD || 'admin123',
  };
};

const brandConfig = getBrandConfig();
export default brandConfig;