# Driver System Setup Guide

## Overview
This system now supports two user roles:
- **Admin** (Restaurant Owner): Full access to manage meals, categories, and business settings
- **Driver**: Limited access to view and manage order delivery status

## Features

### Admin Features
- ✅ Manage meals and categories
- ✅ View all orders and business settings
- ✅ Create and manage driver accounts
- ✅ Cannot mark orders as "delivered" (now driver responsibility)

### Driver Features
- ✅ View active orders (preparing, ready, out_for_delivery)
- ✅ View completed orders (delivered, completed)
- ✅ Mark orders as "out_for_delivery"
- ✅ Mark orders as "delivered"
- ✅ Cannot access meal management or business settings

## Setup Instructions

### 1. Create Admin Account
1. Go to Firebase Console
2. Navigate to Authentication > Users
3. Create a new user with admin email/password
4. In Firestore, create a document at `users/{userId}` with:
   ```json
   {
     "role": "admin",
     "email": "admin@example.com",
     "createdAt": "2024-01-01T00:00:00.000Z"
   }
   ```

### 2. Create Driver Accounts
**Option A: Using Admin Panel (Recommended)**
1. Login as admin
2. Go to "ניהול נהגים" (Driver Management)
3. Fill out the form with driver details
4. Click "إضافة سائق" (Add Driver)

**Option B: Manual Creation**
1. Go to Firebase Console
2. Create user in Authentication
3. Create document in Firestore at `users/{userId}`:
   ```json
   {
     "role": "driver",
     "email": "driver@example.com",
     "name": "Driver Name",
     "phone": "+1234567890",
     "createdAt": "2024-01-01T00:00:00.000Z"
   }
   ```

### 3. Driver Login
1. Drivers can login at `/login`
2. They will be automatically redirected to `/driver/orders`
3. They can only see order management interface

## Order Status Flow

### Admin Actions:
1. **Accept Order** → Status: `preparing`
2. **Mark as Ready** → Status: `ready`

### Driver Actions:
3. **Start Delivery** → Status: `out_for_delivery`
4. **Mark as Delivered** → Status: `delivered`

## Security Rules

### Firestore Rules (Recommended)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Orders: admins can read/write, drivers can read and update status
    match /menus/{menuId}/orders/{orderId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin' ||
         (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'driver' && 
          resource.data.status in ['preparing', 'ready', 'out_for_delivery']));
    }
    
    // Menu data: only admins
    match /menus/{menuId} {
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

## URLs

### Admin Routes:
- `/meals` - Meal management
- `/orders` - Order management (view only)
- `/manage` - Business settings
- `/users` - Driver management

### Driver Routes:
- `/driver/orders` - Order management (driver actions)

## Benefits

1. **Professional Workflow**: Drivers mark delivery status
2. **Accurate Tracking**: Real delivery confirmation
3. **Better UX**: Customers get accurate delivery updates
4. **Security**: Role-based access control
5. **Scalable**: Easy to add more roles later

## Troubleshooting

### Driver can't login:
- Check if user document exists in Firestore
- Verify role is set to "driver"
- Check Firebase Authentication user exists

### Admin can't access pages:
- Verify role is set to "admin" in Firestore
- Check if user document exists

### Orders not updating:
- Check Firestore security rules
- Verify user has correct role permissions 