const brandConfig = {
  id: import.meta.env.VITE_BRAND_ID || 'luqma',
  name: import.meta.env.VITE_BRAND_NAME || 'Luqma',
  logoUrl: import.meta.env.VITE_BRAND_LOGO || 'https://qbmedia.b-cdn.net/luqmaimages/logo.svg',
  themeColor: import.meta.env.VITE_BRAND_COLOR || '#007aff',
  // Audio notification file path (relative to public folder)
  notificationSound: import.meta.env.VITE_NOTIFICATION_SOUND || '/luqma.mp3',
  // Add more as needed (e.g., supportEmail, phone, etc.)
};

export default brandConfig;