# 🍎 Apple Pay Firebase Hosting Setup Guide

This guide explains how to set up Firebase Hosting for the Apple Pay payment page (`tranzila-applepay.html`) for each client app.

## Overview

Each client app needs its own Firebase Hosting deployment of the `tranzila-applepay.html` file. This file hosts the Tranzila Apple Pay iframe integration and must be accessible via HTTPS.

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

Check that `firebase.json` includes hosting configuration:

```json
{
  "hosting": {
    "public": "public",
    "ignore": [
      "firebase.json",
      "**/.*",
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
