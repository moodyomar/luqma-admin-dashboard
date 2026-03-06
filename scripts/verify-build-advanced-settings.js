#!/usr/bin/env node
/**
 * verify-build-advanced-settings.js
 * After building, checks that the allowlist was inlined so Advanced Settings will show in production.
 * Run after: npm run build  (or npm run build:production)
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const root = process.cwd();
const envPath = join(root, '.env');
const distPath = join(root, 'dist');

function getEnvValue(content, key) {
  const match = content.match(new RegExp(`^${key}=(.*)$`, 'm'));
  if (!match) return null;
  const raw = (match[1] || '').trim();
  return raw.replace(/^["']|["']$/g, '').trim();
}

function findJsFiles(dir, files = []) {
  if (!existsSync(dir)) return files;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) findJsFiles(full, files);
    else if (e.name.endsWith('.js')) files.push(full);
  }
  return files;
}

function main() {
  if (!existsSync(envPath)) {
    console.warn('⚠️  .env not found; skipping verify.');
    process.exit(0);
  }

  const content = readFileSync(envPath, 'utf8');
  const value = getEnvValue(content, 'VITE_ADVANCED_SETTINGS_EMAILS');
  const emails = (value || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (emails.length === 0) {
    console.warn('⚠️  VITE_ADVANCED_SETTINGS_EMAILS is empty; cannot verify. Set it and rebuild.');
    process.exit(0);
  }

  if (!existsSync(distPath)) {
    console.error('❌ dist/ not found. Run npm run build first.');
    process.exit(1);
  }

  const jsFiles = findJsFiles(distPath);
  const needle = emails[0];
  let found = false;
  for (const file of jsFiles) {
    try {
      const text = readFileSync(file, 'utf8');
      if (text.includes(needle)) {
        found = true;
        break;
      }
    } catch (_) {}
  }

  if (found) {
    console.log('✓ Build contains Advanced Settings allowlist. Production will show Advanced Settings for configured emails.');
    process.exit(0);
  }

  console.error('❌ Build does not contain allowlist (searched for an email from .env).');
  console.error('   Production may not show Advanced Settings. Ensure .env has VITE_ADVANCED_SETTINGS_EMAILS and run: npm run build:production');
  process.exit(1);
}

main();
