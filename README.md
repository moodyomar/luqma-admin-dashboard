# 🏢 Admin Dashboard

Multi-tenant restaurant management system built with React, Firebase, and Vite. Configure per client via env (e.g. `VITE_BRAND_ID`, `VITE_BRAND_NAME`) or an init script.

## ✨ Features

### 🔒 Multi-Tenant Architecture
- **Complete data isolation** between businesses
- **Custom claims-based authentication** (businessIds, roles)
- **Business switcher** for multi-business admins
- **Tenant-scoped queries** with automatic isolation

### 📊 Admin Dashboard
- **Orders Management**: Real-time order tracking and status updates
- **Menu Management**: Products, categories, and pricing
- **User Management**: Invite users, manage roles (admin/driver)
- **Analytics**: Business metrics and reporting
- **Coupon System**: Discount codes and promotions
- **Business Settings**: Configure business-specific settings

### 👥 Role-Based Access Control
- **Admin**: Full access to business management
- **Driver**: Order fulfillment and status updates
- **Customer**: Mobile app access (React Native)

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Firebase CLI: `npm install -g firebase-tools`
- Firebase project with Firestore and Authentication enabled

### Installation

```bash
# Clone repository
git clone <your-repo-url>
cd admin-dashboard

# Install dependencies
npm install

# Install Cloud Functions dependencies
cd functions && npm install && cd ..

# Configure environment
cp .env.example .env
# Add your Firebase config to .env
```

### Development

```bash
# Run admin dashboard
npm run dev

# Run Firebase emulators (in another terminal)
firebase emulators:start
```

Visit `http://localhost:5173`

---

## 📁 Project Structure

```
admin-dashboard/
├── src/
│   ├── App.jsx                      # Main app component
│   ├── contexts/
│   │   └── AuthContext.jsx          # Multi-tenant authentication
│   ├── components/
│   │   ├── BusinessSwitcher.jsx     # Business switcher UI
│   │   ├── CategoryManager.jsx      # Category management
│   │   ├── MealCard.jsx             # Product card
│   │   └── ...
│   └── styles/
├── pages/
│   ├── OrdersPage.jsx               # Orders management
│   ├── MealsPage.jsx                # Menu/products management
│   ├── BusinessManagePage.jsx       # Business settings
│   ├── AnalyticsPage.jsx            # Analytics dashboard
│   ├── DriverOrdersPage.jsx         # Driver orders view
│   └── UserManagementPage.jsx       # User management
├── utils/
│   ├── tenantUtils.js               # Tenant-scoped queries
│   ├── couponUtils.js               # Coupon validation
│   └── userManagement.js            # User operations
├── functions/                        # Cloud Functions
│   ├── src/
│   │   ├── index.ts                 # Functions exports
│   │   ├── inviteUser.ts            # User invitation
│   │   ├── setClaims.ts             # Claims management
│   │   └── tools/
│   │       └── backfillClaims.ts    # Migration script
│   └── README.md                    # Functions documentation
├── firestore.rules                  # Tenant-aware security rules
└── package.json
```

---

## 🏗️ Multi-Tenant Architecture

### Data Structure

```
/menus/{businessId}/
├── users/{uid}              # Business members
├── orders/{orderId}         # Orders
├── products/{productId}     # Menu items
├── categories/{categoryId}  # Product categories
├── coupons/{couponId}       # Discount coupons
└── config                   # Business configuration
```

### Custom Claims

```javascript
{
  businessIds: ["your-brand"],  // Businesses user can access (from VITE_BRAND_ID)
  roles: ["admin"]                     // User's roles
}
```

### Access Control

1. User signs in → Firebase validates credentials
2. Custom claims loaded from token
3. AuthContext validates business access
4. Firestore rules enforce tenant isolation
5. User can only access their business data

---

## 🔐 Security

### Firestore Rules
- ✅ Validate `businessIds` from custom claims
- ✅ Role-based access control (admin, driver)
- ✅ Prevent cross-tenant data access
- ✅ Public reads for menu display

### Best Practices
```javascript
// ✅ GOOD: Use activeBusinessId from AuthContext
const { activeBusinessId } = useAuth();
const ordersRef = getTenantCollection(activeBusinessId, 'orders');

// ❌ BAD: Never hard-code business ID
const ordersRef = collection(db, 'menus', businessId, 'orders');  // businessId from brandConfig or context
```

---

## 📦 Deployment

### 1. Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

### 2. Deploy Cloud Functions

```bash
cd functions
npm run build
firebase deploy --only functions
```

### 3. Deploy Admin Dashboard

**Vercel (Current)**:
```bash
git push origin main
# Vercel auto-deploys
```

**Firebase Hosting**:
```bash
npm run build
firebase deploy --only hosting
```

### 4. Run Backfill Script (First-time setup)

```bash
cd functions
npm run build
node lib/tools/backfillClaims.js
```

This sets custom claims for existing users. Users must sign out and back in after running this.

---

## 🧪 Testing

### Test Scenarios

**Single Business Admin**:
- Claims: `{ businessIds: ["your-brand"], roles: ["admin"] }`
- ✓ Can access that business's data
- ✗ Cannot access other businesses
- ✗ No business switcher

**Multi-Business Admin**:
- Claims: `{ businessIds: ["your-brand", "other-brand"], roles: ["admin"] }`
- ✓ Can access both businesses
- ✓ Business switcher appears
- ✓ Data updates when switching

**Driver**:
- Claims: `{ businessIds: ["your-brand"], roles: ["driver"] }`
- ✓ Can view/update orders
- ✗ Cannot access products/settings

---

## 🛠️ Development

### Key Utilities

```javascript
// Get active business
const { activeBusinessId, isAdmin, isDriver } = useAuth();

// Tenant-scoped collection
import { getTenantCollection } from './utils/tenantUtils';
const ordersRef = getTenantCollection(activeBusinessId, 'orders');

// Tenant-scoped document
import { getTenantDoc } from './utils/tenantUtils';
const orderRef = getTenantDoc(activeBusinessId, 'orders', orderId);

// Switch business (multi-business users)
const { switchBusiness } = useAuth();
switchBusiness('refresh');
```

### Adding a New Page

1. Create page in `pages/YourPage.jsx`
2. Use `useAuth()` to get `activeBusinessId`
3. Use `getTenantCollection()` for all queries
4. Add route in `src/App.jsx`
5. Test with multiple business accounts

---

## 🚨 Troubleshooting

### Permission Denied Errors
- Check user's custom claims in Firebase Console
- Verify `businessIds` includes correct business
- Ensure Firestore rules are deployed
- Confirm queries use `activeBusinessId`

### User Can't Sign In
- Check custom claims: `user.getIdTokenResult()`
- Verify businessIds array is not empty
- Ensure user signed out/in after backfill

### Data Not Loading
- Verify query uses `getTenantCollection(activeBusinessId, ...)`
- Check `activeBusinessId` is set in AuthContext
- Confirm data exists under `menus/{businessId}/...`

---

## 📚 Documentation

- **[Cloud Functions README](./functions/README.md)**: Functions API reference
- **[Coupon System Guide](./COUPON_SYSTEM_README.md)**: Coupon management
- **[Driver Setup Guide](./DRIVER_SETUP.md)**: Driver role configuration

---

## 🔧 Tech Stack

- **Frontend**: React 18, Vite 5
- **Backend**: Firebase (Firestore, Auth, Functions)
- **Styling**: Custom CSS
- **Deployment**: Vercel (Frontend), Firebase (Functions)
- **Language**: JavaScript (Frontend), TypeScript (Functions)

---

## 📝 Environment Variables

Create `.env` file:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

---

## 🤝 Contributing

1. Follow clean code principles
2. Use tenant-scoped queries everywhere
3. Never hard-code business IDs
4. Test with multiple business accounts
5. Update documentation when needed

---

## 📄 License

[Your License Here]

---

## 🙏 Support

For issues or questions:
- Check troubleshooting section above
- Review Firebase Console for errors
- Check function logs: `firebase functions:log`

---

**Last Updated**: October 11, 2025  
**Version**: 1.0  
**Status**: Production Ready
