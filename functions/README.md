# 🔥 Firebase Cloud Functions - Multi-Tenant System

## Overview

This directory contains Firebase Cloud Functions for managing multi-tenant user access and custom claims.

---

## 📦 Functions

### `inviteUser`
**Type**: Callable HTTPS Function  
**Purpose**: Create or update users and set custom claims for business access

**Parameters**:
```typescript
{
  businessId: string;        // Required: Business to add user to
  email?: string;            // Email (email or phone required)
  phone?: string;            // Phone number (email or phone required)
  role: "admin" | "driver";  // Required: User role
  displayName?: string;      // Optional: Display name
}
```

**Returns**:
```typescript
{
  uid: string;               // User ID
  email?: string;            // User email
  phone?: string;            // User phone
  isNewUser: boolean;        // Whether user was created or existing
  message: string;           // Success message
}
```

**Usage** (from client):
```javascript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const inviteUser = httpsCallable(functions, 'inviteUser');

const result = await inviteUser({
  businessId: 'your-brand',  // e.g. client id from VITE_BRAND_ID
  email: 'user@example.com',
  role: 'admin',
  displayName: 'John Doe'
});

console.log(result.data); // { uid, email, isNewUser, message }
```

---

### `addBusinessClaims`
**Type**: Helper Function (not directly callable)  
**Purpose**: Add business and role claims to a user

**Usage** (from other functions):
```typescript
import { addBusinessClaims } from './setClaims';

await addBusinessClaims(uid, 'your-brand', ['admin']);
```

---

### `removeBusinessClaims`
**Type**: Helper Function (not directly callable)  
**Purpose**: Remove business access from a user

**Usage** (from other functions):
```typescript
import { removeBusinessClaims } from './setClaims';

await removeBusinessClaims(uid, 'your-brand');
```

---

### `forceTokenRefresh`
**Type**: Helper Function (not directly callable)  
**Purpose**: Revoke refresh tokens to force claim update

**Usage** (from other functions):
```typescript
import { forceTokenRefresh } from './setClaims';

await forceTokenRefresh(uid);
```

---

## 🛠️ Development

### Install Dependencies
```bash
npm install
```

### Build TypeScript
```bash
npm run build
```

### Run Locally (Emulator)
```bash
npm run serve
```

### Deploy to Firebase
```bash
npm run deploy
```

### View Logs
```bash
npm run logs
```

---

## 🧪 Testing

### Test inviteUser Function

**Using Firebase Emulator**:
```bash
# Start emulator
npm run serve

# In another terminal, call the function
curl -X POST http://localhost:5001/YOUR_PROJECT_ID/us-central1/inviteUser \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "businessId": "your-brand",
      "email": "test@example.com",
      "role": "admin"
    }
  }'
```

**Using Firebase Console**:
1. Go to Firebase Console → Functions
2. Find `inviteUser` function
3. Click "Test function"
4. Enter test data
5. View results

---

## 🔧 Maintenance

### Run Backfill Script

**Purpose**: Set custom claims for existing users

```bash
# Build first
npm run build

# Run script
node lib/tools/backfillClaims.js
```

**Expected Output**:
```
🚀 Starting claims backfill...
📋 Collecting all membership documents...
✅ Collected 8 total memberships
📊 Found 8 unique users
🔧 Setting custom claims...
  ✅ user1: 1 business(es), roles: admin
  ✅ user2: 1 business(es), roles: driver
==================================================
📊 BACKFILL SUMMARY
==================================================
✅ Success: 8 users
❌ Errors: 0 users
==================================================
```

---

## 📊 Monitoring

### View Function Logs
```bash
# All logs
firebase functions:log

# Specific function
firebase functions:log --only inviteUser

# Filter errors
firebase functions:log --only inviteUser | grep ERROR
```

### Check Function Performance
1. Go to Firebase Console → Functions
2. Click on function name
3. View metrics: invocations, execution time, errors

---

## 🚨 Troubleshooting

### Error: "Permission denied"
**Cause**: Caller doesn't have admin role or business access  
**Solution**: Check caller's custom claims in Firebase Console

### Error: "User not found"
**Cause**: Email/phone doesn't exist and creation failed  
**Solution**: Check function logs for detailed error message

### Error: "Invalid argument"
**Cause**: Missing required parameters  
**Solution**: Verify all required fields are provided

### Claims not updating
**Cause**: User needs to refresh token  
**Solution**: User must sign out and sign in again

---

## 📝 Custom Claims Structure

```javascript
{
  businessIds: ["your-brand"],  // Array of business IDs (e.g. from VITE_BRAND_ID)
  roles: ["admin", "driver"]          // Array of roles
}
```

**Max Size**: 1000 bytes per user  
**Update Method**: Server-side only (via Admin SDK)  
**Refresh**: Automatic on token expiry or manual sign-out/sign-in

---

## 🔐 Security

### Authentication
- All callable functions require authentication
- Admin role required for `inviteUser`
- Business access validated before operations

### Authorization
- Caller must have admin role
- Caller must have access to target business
- Claims are validated server-side

### Best Practices
1. Never expose Admin SDK credentials
2. Always validate input parameters
3. Log all user management operations
4. Monitor for suspicious activity
5. Use HTTPS only

---

## 📚 Resources

- [Firebase Functions Documentation](https://firebase.google.com/docs/functions)
- [Custom Claims Documentation](https://firebase.google.com/docs/auth/admin/custom-claims)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

---

**Last Updated**: October 10, 2025  
**Version**: 1.0  
**Node Version**: 18+  
**Firebase Admin SDK**: 12.0.0+













