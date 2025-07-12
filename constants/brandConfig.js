const brandConfig = {
  id: import.meta.env.VITE_BRAND_ID || 'luqma',
  name: import.meta.env.VITE_BRAND_NAME || 'Luqma',
  logoUrl: import.meta.env.VITE_BRAND_LOGO || 'https://qbmedia.b-cdn.net/luqmaimages/logo.svg',
  themeColor: import.meta.env.VITE_BRAND_COLOR || '#007aff',
  // Add more as needed (e.g., supportEmail, phone, etc.)
};

export default brandConfig;