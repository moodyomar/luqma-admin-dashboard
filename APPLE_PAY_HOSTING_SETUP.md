# 🍎 Apple Pay Firebase Hosting Setup Guide

This guide explains how to set up Firebase Hosting for the Apple Pay payment page (`tranzila-applepay.html`) for each client app.

## Overview

Each client app needs its own Firebase Hosting deployment of the `tranzila-applepay.html` file. This file hosts the Tranzila Apple Pay iframe integration and must be accessible via HTTPS.

**For each new white-label app:** you only need to deploy this same webpage (and optionally the domain verification file) to that app’s Firebase Hosting. The app already gets the hosting URL from Firestore (`config.payment.applePay.hostingUrl`) or from the Firebase project ID, and the terminal name from `config.payment.tranzila.terminalName` — no app rebuild. No Luqma or client-specific values are hardcoded in the app or the HTML.

---

## Per-client deployment checklist (same as Visa / payment config)

Do this once per white-label app so Apple Pay works like the rest of payment (Tranzila/Visa):

1. **Source files (in luqma repo, synced to template)**  
   - `menu-app/public/tranzila-applepay.html`  
   - `menu-app/public/.well-known/apple-developer-merchantid-domain-association`  
   These are generic; they get `terminal`, `sum`, `currency` from the URL the app sends. No client name inside.

2. **For each client**  
   - Copy the two files above into that client’s **menu-app** `public/` (e.g. in MenuAppTemplate: `Clients/{client}/{client}-mobile/public/`).  
   - In that client’s directory, run `firebase use <client-firebase-project-id>` and `firebase deploy --only hosting`.  
   - In **Advanced Settings** in the admin dashboard for that client: enable Apple Pay, set Tranzila terminal name, and either leave **Hosting URL** empty (app will use `https://<client-project-id>.web.app`) or set it explicitly.  
   - Optionally add the domain in Apple Pay (Tranzila/Apple) and ensure the `.well-known` file is reachable at `https://<client-project-id>.web.app/.well-known/apple-developer-merchantid-domain-association`.

3. **Scripts (scalable)**  
   - **sync-template.sh** (luqma → MenuAppTemplate): syncs `menu-app/public/tranzila-applepay.html` and `menu-app/public/.well-known/` into the template, so all clients get the same generic page.  
   - **update-client.sh** (in MenuAppTemplate): when updating a client’s **mobile** app, automatically patches `firebase.json` if it has `hosting.ignore` containing `"**/.*"` (which would exclude `.well-known` and cause "Payment Not Completed"). The script sets a safe ignore list so `.well-known` is always deployed. No manual firebase.json edit per client.  
   - After update, deploy hosting from the client’s menu-app: `firebase use <projectId>` then `firebase deploy --only hosting`.

4. **Tranzila: allow the domain per terminal**  
   For each client, ask Tranzila to **allow the domain** for that terminal (e.g. `https://safaa-menu-app.web.app` for Safaa). Without this, Apple Pay can show "Payment Not Completed" even when the page and `.well-known` are deployed. Iframe and Apple Pay must be enabled for that terminal in [my.tranzila.com](https://my.tranzila.com) (e.g. Settings → iframe; Payment options).

5. **Admin dashboard**  
   - **Advanced Settings → Apple Pay**: Hosting URL (optional; leave empty to use Firebase project ID), Merchant ID, Country, Currency. All values are per client; no Luqma defaults in the UI.

---

## What Luqma has (100% working reference)

Luqma is the reference setup. Here’s what’s in place:

| Item | Luqma setup |
|------|-------------|
| **Firebase project** | `qbmenu-7963c` (QBMenu) |
| **Hosting domains** | `qbmenu-7963c.web.app`, `qbmenu-7963c.firebaseapp.com` |
| **Apple Pay page** | `https://qbmenu-7963c.web.app/tranzila-applepay.html` — same file as `menu-app/public/tranzila-applepay.html` |
| **Tranzila terminal** | `fxpluqma` (shown in Apple Pay sheet as “Pay fxpluqma”) |
| **Hosting URL in app** | From Firestore `config.payment.applePay.hostingUrl` or auto from `firebaseConfig.projectId` → `https://qbmenu-7963c.web.app` |
| **Domain verification** | `menu-app/public/.well-known/apple-developer-merchantid-domain-association` deployed so Apple can verify the domain; URL: `https://qbmenu-7963c.web.app/.well-known/apple-developer-merchantid-domain-association` |

**Files deployed to Firebase Hosting for Luqma:**

- `menu-app/public/tranzila-applepay.html` — loads Tranzila script, reads `sum`, `currency`, `terminal` from URL (terminal is always passed by the app from config; no hardcoded client), embeds Tranzila iframe, posts success/failure back to the app.
- `menu-app/public/.well-known/apple-developer-merchantid-domain-association` — Apple Pay domain verification (required for the domain used in the payment sheet).

**App side (no client-specific code):** `TranzilaApplePayIframe.js` and `tranzilaApplePaySafari.js` build the URL from `config.applePay.hostingUrl` (or `https://${projectId}.web.app`) and `config.tranila.terminalName`. Each brand only needs the correct Firestore config (Advanced Settings) and its own hosted page.

## Prerequisites

- Firebase CLI installed: `npm install -g firebase-tools`
- Firebase project created for each client
- Access to the client's Firebase project

## Step-by-Step Setup

### Step 1: Locate the HTML File

The `tranzila-applepay.html` file is located in:
```
menu-app/public/tranzila-applepay.html
```

### Step 2: Copy File to Client's Firebase Project

For each client (e.g., "safaa", "luqma", etc.):

1. **Navigate to the client's menu-app directory:**
   ```bash
   cd /Users/moody/Documents/Dev/MenuAppTemplate/Clients/{client-name}/{client-name}-mobile
   ```

2. **Ensure Firebase Hosting is initialized:**
   ```bash
   firebase init hosting
   ```
   
   When prompted:
   - **Public directory:** `public` (or create it if it doesn't exist)
   - **Single-page app:** `N` (No)
   - **Set up automatic builds:** `N` (No, unless you want CI/CD)
   - **Overwrite existing files:** `N` (No, if files exist)

3. **Copy the HTML file:**
   ```bash
   # Copy from luqma main project
   cp /Users/moody/Documents/Dev/luqma/menu-app/public/tranzila-applepay.html ./public/
   ```

   Or manually create `public/tranzila-applepay.html` with the content from the main project.

### Step 3: Verify Firebase Configuration

Check that `firebase.json` includes hosting configuration. **Important:** Do **not** use `"**/.*"` in `ignore` — that excludes the `.well-known` folder, so the Apple Pay domain verification file is never deployed and you get "Payment Not Completed". Use explicit ignores instead:

```json
{
  "hosting": {
    "public": "public",
    "ignore": [
      "firebase.json",
      ".DS_Store",
      "**/node_modules/**"
    ]
  }
}
```

### Step 4: Deploy to Firebase Hosting

```bash
firebase deploy --only hosting
```

**Expected output:**
```
✔ Deploy complete!

Hosting URL: https://{project-id}.web.app
```

### Step 5: Verify the File is Accessible

Test the URL:
```bash
curl https://{project-id}.web.app/tranzila-applepay.html
```

You should see the HTML content (not a 404 error).

### Step 6: Configure in Admin Dashboard

1. **Log in to the admin dashboard** (e.g., `https://{client}-dashboard.vercel.app`)

2. **Navigate to Advanced Settings** (إعدادات متقدمة)
   - Only visible to users in `VITE_ADVANCED_SETTINGS_EMAILS`

3. **Find the Apple Pay section**

4. **Enter the Hosting URL:**
   - Format: `https://{project-id}.web.app`
   - Example for safaa: `https://safaa-project-id.web.app`
   - Example for luqma: `https://qbmenu-7963c.web.app`

5. **Click "حفظ الإعدادات" (Save Settings)**

6. **Verify in Firebase:**
   - Go to Firebase Console → Firestore
   - Navigate to `menus/{client-id}`
   - Check `config.payment.applePay.hostingUrl` is set

## Auto-Generation (Fallback)

If the **Hosting URL** field is left **empty** in the admin dashboard:

- The app will automatically generate the URL from the Firebase project ID
- Format: `https://{FIREBASE_PROJECT_ID}.web.app`
- This works if the Firebase project ID matches the hosting domain

**Example:**
- If `FIREBASE_PROJECT_ID=qbmenu-7963c`
- Auto-generated URL: `https://qbmenu-7963c.web.app`

## Multiple Clients Setup

### For Each Client:

1. **Create Firebase Project** (if not exists)
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create new project or use existing

2. **Initialize Hosting:**
   ```bash
   cd {client-name}-mobile
   firebase use {project-id}
   firebase init hosting
   ```

3. **Deploy HTML File:**
   ```bash
   cp /path/to/tranzila-applepay.html ./public/
   firebase deploy --only hosting
   ```

4. **Configure in Admin Dashboard:**
   - Enter the hosting URL in Advanced Settings → Apple Pay

## Troubleshooting

### File Not Accessible (404)

1. **Check file exists:**
   ```bash
   ls -la public/tranzila-applepay.html
   ```

2. **Verify firebase.json:**
   ```bash
   cat firebase.json
   ```
   Ensure `hosting.public` is set to `public`

3. **Redeploy:**
   ```bash
   firebase deploy --only hosting
   ```

### Wrong Domain in Apple Pay

1. **Check Firebase project:**
   ```bash
   firebase projects:list
   firebase use {correct-project-id}
   ```

2. **Verify admin dashboard config:**
   - Check `config.payment.applePay.hostingUrl` in Firestore
   - Ensure it matches the deployed Firebase Hosting URL

3. **Check app's Firebase config:**
   - Verify `FIREBASE_PROJECT_ID` in `.env` matches the hosting project

### Custom Domain (Optional)

If you want to use a custom domain instead of `.web.app`:

1. **Add custom domain in Firebase Console:**
   - Firebase Console → Hosting → Add custom domain
   - Follow DNS setup instructions

2. **Update admin dashboard:**
   - Enter custom domain URL (e.g., `https://pay.{client-domain}.com`)

## Quick Reference

### Commands Summary

```bash
# Initialize hosting
firebase init hosting

# Deploy
firebase deploy --only hosting

# Check current project
firebase use

# List projects
firebase projects:list

# Switch project
firebase use {project-id}
```

### File Locations

- **Source HTML:** `/Users/moody/Documents/Dev/luqma/menu-app/public/tranzila-applepay.html`
- **Client deployment:** `{client}-mobile/public/tranzila-applepay.html`
- **Firebase config:** `{client}-mobile/firebase.json`

### Admin Dashboard Path

- **Settings:** Advanced Settings (إعدادات متقدمة)
- **Field:** Apple Pay → Hosting URL
- **Firestore path:** `menus/{client-id}/config/payment/applePay/hostingUrl`

## Best Practices

1. **Use separate Firebase projects per client** for isolation
2. **Test the URL** after deployment: `curl https://{url}/tranzila-applepay.html`
3. **Document the hosting URL** for each client in your project notes
4. **Set up monitoring** to ensure the file remains accessible
5. **Use environment variables** for project IDs in CI/CD if automating deployments

## Related Files

- `menu-app/public/tranzila-applepay.html` - Source HTML file
- `admin-dashboard/pages/AdvancedSettingsPage.jsx` - Admin UI for configuration
- `menu-app/components/TranzilaApplePayIframe.js` - Component that uses the URL
- `menu-app/utils/tranzilaApplePaySafari.js` - Safari handler that uses the URL
- `menu-app/hooks/usePaymentConfig.js` - Hook that fetches remote config
