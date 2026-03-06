#!/usr/bin/env node
/**
 * ensure-advanced-settings-env.js
 * Ensures .env has VITE_ADVANCED_SETTINGS_EMAILS set (required for Advanced Settings to show in production).
 * Vite inlines this at build time; if empty, no one can see Advanced Settings or Debug Tools.
 * Run before building for production, or use: npm run build:production
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
const envPath = join(root, '.env');

function getEnvValue(content, key) {
  const match = content.match(new RegExp(`^${key}=(.*)$`, 'm'));
  if (!match) return null;
  const raw = (match[1] || '').trim();
  return raw.replace(/^["']|["']$/g, '').trim();
}

function main() {
  if (!existsSync(envPath)) {
    console.error('❌ .env not found. Create .env with at least VITE_ADVANCED_SETTINGS_EMAILS=your@email.com');
    process.exit(1);
  }

  let content = readFileSync(envPath, 'utf8');
  const hasKey = /^VITE_ADVANCED_SETTINGS_EMAILS=/m.test(content);
  const value = getEnvValue(content, 'VITE_ADVANCED_SETTINGS_EMAILS');

  if (!hasKey) {
    content += '\n# Developer-only: comma-separated emails that can see Advanced Settings (required for production build)\n';
    content += 'VITE_ADVANCED_SETTINGS_EMAILS=\n';
    writeFileSync(envPath, content);
    console.warn('⚠️  Added VITE_ADVANCED_SETTINGS_EMAILS to .env (empty).');
    console.warn('   Edit .env and add your email(s), then run again: npm run ensure:advanced-settings-env');
    process.exit(1);
  }

  const emails = (value || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (emails.length === 0) {
    console.error('❌ VITE_ADVANCED_SETTINGS_EMAILS is empty in .env.');
    console.error('   Production build will not show Advanced Settings or Debug Tools for any user.');
    console.error('   Edit .env and add at least one email, e.g.:');
    console.error('   VITE_ADVANCED_SETTINGS_EMAILS=apps@qbmedia.co,dev@example.com');
    process.exit(1);
  }

  console.log('✓ VITE_ADVANCED_SETTINGS_EMAILS is set (' + emails.length + ' email(s)). Production build will show Advanced Settings for these users.');
  process.exit(0);
}

main();
