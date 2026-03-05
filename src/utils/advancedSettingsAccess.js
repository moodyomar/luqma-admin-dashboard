/**
 * Advanced Settings – code-only access via VITE_ADVANCED_SETTINGS_EMAILS.
 * Comma-separated list of emails; only these users can see and open Advanced Settings.
 * Set in admin-dashboard .env (e.g. VITE_ADVANCED_SETTINGS_EMAILS=you@example.com).
 */

const ALLOWLIST = (import.meta.env.VITE_ADVANCED_SETTINGS_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function canAccessAdvancedSettings(user) {
  if (!user?.email) return false;
  return ALLOWLIST.includes(user.email.toLowerCase());
}

export default canAccessAdvancedSettings;
