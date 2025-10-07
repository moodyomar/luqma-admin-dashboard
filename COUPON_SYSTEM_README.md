# 🎫 Professional Coupon Management System

A comprehensive, modern coupon management system for your React Native app with admin dashboard integration.

## ✨ Features

### 🎯 **Modern & Professional Design**
- Clean, intuitive admin interface
- Real-time coupon validation
- Professional status indicators
- Mobile-responsive design

### 🔧 **Advanced Coupon Types**
- **Percentage Discounts**: Set percentage off (e.g., 20% OFF)
- **Fixed Amount Discounts**: Set fixed amount off (e.g., ₪10 OFF)
- **Maximum Discount Limits**: Cap percentage discounts at a maximum amount
- **Minimum Order Requirements**: Require minimum order amount

### 📊 **Smart Management**
- **Usage Tracking**: Monitor how many times each coupon is used
- **Usage Limits**: Set maximum usage per coupon
- **Expiration Dates**: Automatic expiration handling
- **Status Management**: Active/Inactive toggle
- **Bulk Operations**: Easy management of multiple coupons

### 🛡️ **Security & Validation**
- **Real-time Validation**: Instant coupon verification
- **Error Handling**: Comprehensive error messages
- **Usage Prevention**: Prevent expired/inactive coupon usage
- **Firebase Integration**: Secure cloud storage

## 🏗️ Firebase Structure

```
/menus/{brandId}/coupons/
├── {couponId}/
│   ├── code: string (e.g., "SAVE20")
│   ├── type: "percentage" | "fixed_amount"
│   ├── value: number (20 for 20% or ₪20)
│   ├── description: string (optional)
│   ├── expiresAt: timestamp (optional)
│   ├── usageLimit: number (optional)
│   ├── usageCount: number (auto-increment)
│   ├── minOrderAmount: number (optional)
│   ├── maxDiscountAmount: number (optional, for percentage)
│   ├── status: "active" | "inactive"
│   ├── createdAt: timestamp
│   └── updatedAt: timestamp
```

## 🚀 Quick Start

### 1. **Admin Dashboard Setup**
The coupon management page is already integrated into your admin dashboard:

- **URL**: `/coupons`
- **Navigation**: Available from the main admin menu
- **Access**: Admin users only

### 2. **React Native App Integration**

#### Step 1: Copy Utility Files
Copy these files to your React Native project:
- `utils/reactNativeCouponUtils.js`

#### Step 2: Install Dependencies
```bash
npm install @react-native-firebase/firestore
# or
yarn add @react-native-firebase/firestore
```

#### Step 3: Configure Firebase
Update the utility functions with your Firebase configuration:

```javascript
// In your React Native app
import { validateCouponInApp } from './utils/reactNativeCouponUtils';

const firebaseConfig = {
  brandId: 'your-brand-id' // Same as in admin dashboard
};

// Validate coupon
const result = await validateCouponInApp('SAVE20', 100, firebaseConfig);
```

#### Step 4: Add Coupon Input Component
Use the provided React Native component example in `reactNativeCouponUtils.js`.

## 🎨 Admin Dashboard Features

### 📋 **Coupon List View**
- **Status Indicators**: Color-coded status badges
- **Quick Actions**: Edit, delete, toggle status
- **Filter Options**: All, Active, Inactive, Expired
- **Search & Sort**: Easy coupon management

### ➕ **Create New Coupons**
- **Auto-Generate Codes**: Random 8-character codes
- **Manual Code Entry**: Custom coupon codes
- **Flexible Discounts**: Percentage or fixed amount
- **Advanced Settings**: Expiration, usage limits, minimum orders

### ✏️ **Edit Existing Coupons**
- **Real-time Updates**: Changes saved instantly
- **Usage Tracking**: Monitor coupon performance
- **Status Management**: Activate/deactivate coupons

## 💡 Usage Examples

### Creating a Percentage Discount
```javascript
const couponData = {
  code: "SAVE20",
  type: "percentage",
  value: 20, // 20% off
  description: "20% off your first order",
  expiresAt: "2024-12-31T23:59:59Z",
  usageLimit: 100,
  minOrderAmount: 50,
  maxDiscountAmount: 25 // Max ₪25 discount
};
```

### Creating a Fixed Amount Discount
```javascript
const couponData = {
  code: "WELCOME10",
  type: "fixed_amount",
  value: 10, // ₪10 off
  description: "₪10 off for new customers",
  expiresAt: "2024-06-30T23:59:59Z",
  usageLimit: 500,
  minOrderAmount: 25
};
```

## 🔧 Technical Details

### **Validation Logic**
1. **Code Existence**: Check if coupon exists
2. **Status Check**: Verify coupon is active
3. **Expiration**: Check if coupon has expired
4. **Usage Limit**: Verify usage count < limit
5. **Minimum Order**: Check order amount ≥ minimum
6. **Discount Calculation**: Calculate final discount amount

### **Error Handling**
- **User-Friendly Messages**: Clear error descriptions
- **Graceful Fallbacks**: Handle network issues
- **Validation Feedback**: Real-time input validation

### **Performance Optimizations**
- **Efficient Queries**: Optimized Firebase queries
- **Caching**: Smart data caching
- **Lazy Loading**: Load coupons on demand

## 🎯 Best Practices

### **Coupon Code Naming**
- Use uppercase letters and numbers
- Keep codes memorable (e.g., "SAVE20", "WELCOME10")
- Avoid special characters

### **Discount Strategy**
- **Percentage**: Good for high-value orders
- **Fixed Amount**: Better for low-value orders
- **Maximum Limits**: Prevent excessive discounts

### **Usage Limits**
- Set reasonable limits for promotional coupons
- Use unlimited for general discounts
- Monitor usage patterns

### **Expiration Management**
- Set clear expiration dates
- Use shorter periods for promotional campaigns
- Consider seasonal expiration

## 🔒 Security Considerations

- **Server-Side Validation**: Always validate on backend
- **Usage Tracking**: Prevent duplicate usage
- **Access Control**: Admin-only coupon management
- **Data Integrity**: Consistent Firebase rules

## 📱 Mobile App Integration

### **Coupon Input Flow**
1. User enters coupon code
2. Real-time validation
3. Success/error feedback
4. Apply discount to order
5. Track usage automatically

### **User Experience**
- **Instant Feedback**: Immediate validation results
- **Clear Messaging**: User-friendly error messages
- **Visual Indicators**: Clear success/error states
- **Easy Removal**: Simple coupon removal

## 🚀 Future Enhancements

- **Analytics Dashboard**: Coupon performance metrics
- **Bulk Import**: CSV coupon import
- **Auto-Generated Codes**: Smart code generation
- **Customer-Specific Coupons**: Personal discount codes
- **Category Restrictions**: Limit coupons to specific categories

## 📞 Support

For technical support or questions about the coupon system, please refer to the code comments or contact your development team.

---

**Built with ❤️ for modern e-commerce applications**
