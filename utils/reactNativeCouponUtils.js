// utils/reactNativeCouponUtils.js
// This file contains the coupon utilities that can be used in your React Native app

/**
 * Coupon Types
 */
export const COUPON_TYPES = {
  PERCENTAGE: 'percentage',
  FIXED_AMOUNT: 'fixed_amount'
};

/**
 * Coupon Status
 */
export const COUPON_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  EXPIRED: 'expired'
};

/**
 * Validate a coupon code (for React Native app)
 * @param {string} code - Coupon code
 * @param {number} orderAmount - Order total amount
 * @param {Object} firebaseConfig - Your Firebase configuration
 * @returns {Promise<Object>} Validation result
 */
export const validateCouponInApp = async (code, orderAmount = 0, firebaseConfig) => {
  try {
    // You'll need to implement this based on your React Native Firebase setup
    // This is a template - adapt it to your specific Firebase implementation
    
    const coupon = await getCouponByCodeInApp(code, firebaseConfig);
    
    if (!coupon) {
      return {
        valid: false,
        error: 'קוד הנחה לא תקין'
      };
    }
    
    // Check if coupon is active
    if (!coupon.isActive) {
      return {
        valid: false,
        error: 'הקופון לא פעיל'
      };
    }
    
    // Check expiration date
    if (coupon.expiryDate) {
      try {
        let expiryDate;
        // Handle both Firebase Timestamp objects and date strings
        if (coupon.expiryDate && typeof coupon.expiryDate === 'object' && coupon.expiryDate.toDate) {
          // Firebase Timestamp
          expiryDate = coupon.expiryDate.toDate();
        } else {
          // Date string
          expiryDate = new Date(coupon.expiryDate);
        }
        
        if (!isNaN(expiryDate.getTime()) && expiryDate < new Date()) {
          return {
            valid: false,
            error: 'פג תוקף הקופון'
          };
        }
      } catch (error) {
        // Invalid date format, continue validation
      }
    }
    
    // Check usage limit
    if (coupon.maxUsage && coupon.usageCount >= coupon.maxUsage) {
      return {
        valid: false,
        error: 'הגעת למגבלת השימוש בקופון'
      };
    }
    
    // Check minimum order amount
    if (coupon.minimumOrder && orderAmount < coupon.minimumOrder) {
      return {
        valid: false,
        error: `הזמנה מינימלית ₪${coupon.minimumOrder}`
      };
    }
    
    // Calculate discount
    let discountAmount = 0;
    if (coupon.discountType === COUPON_TYPES.PERCENTAGE) {
      discountAmount = (orderAmount * coupon.discountValue) / 100;
    } else if (coupon.discountType === COUPON_TYPES.FIXED_AMOUNT) {
      discountAmount = coupon.discountValue;
      // Don't allow discount to exceed order amount
      if (discountAmount > orderAmount) {
        discountAmount = orderAmount;
      }
    }
    
    return {
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount: Math.round(discountAmount * 100) / 100,
        description: coupon.description
      }
    };
  } catch (error) {
    console.error('Error validating coupon:', error);
    return {
      valid: false,
      error: 'שגיאה בבדיקת הקופון'
    };
  }
};

/**
 * Get a specific coupon by code (for React Native app)
 * @param {string} code - Coupon code
 * @param {Object} firebaseConfig - Your Firebase configuration
 * @returns {Promise<Object|null>} Coupon data or null if not found
 */
export const getCouponByCodeInApp = async (code, firebaseConfig) => {
  try {
    // Implement this based on your React Native Firebase setup
    // Example using Firestore:
    /*
    const couponsRef = firestore().collection('menus').doc(firebaseConfig.brandId).collection('coupons');
    const snapshot = await couponsRef.where('code', '==', code.toUpperCase()).get();
    
    if (snapshot.empty) {
      return null;
    }
    
    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data()
    };
    */
    
    // Placeholder - replace with your actual implementation
    console.log('getCouponByCodeInApp - implement with your Firebase setup');
    return null;
  } catch (error) {
    console.error('Error getting coupon by code:', error);
    throw error;
  }
};

/**
 * Apply a coupon (increment usage count) - for React Native app
 * @param {string} couponId - Coupon document ID
 * @param {Object} firebaseConfig - Your Firebase configuration
 * @returns {Promise<void>}
 */
export const applyCouponInApp = async (couponId, firebaseConfig) => {
  try {
    // Implement this based on your React Native Firebase setup
    // Example using Firestore:
    /*
    const couponRef = firestore().collection('menus').doc(firebaseConfig.brandId).collection('coupons').doc(couponId);
    await couponRef.update({
      usageCount: firestore.FieldValue.increment(1),
      updatedAt: new Date().toISOString()
    });
    */
    
    // Placeholder - replace with your actual implementation
    console.log('applyCouponInApp - implement with your Firebase setup');
  } catch (error) {
    console.error('Error applying coupon:', error);
    throw error;
  }
};

/**
 * Format date for display (DD.MM.YYYY)
 * @param {any} dateInput - Date input (Firebase Timestamp, Date object, or string)
 * @returns {string} Formatted date string
 */
export const formatDateForDisplay = (dateInput) => {
  try {
    let date;
    // Handle both Firebase Timestamp objects and date strings
    if (dateInput && typeof dateInput === 'object' && dateInput.toDate) {
      // Firebase Timestamp
      date = dateInput.toDate();
    } else if (dateInput) {
      // Date string or Date object
      date = new Date(dateInput);
    }
    
    if (!date || isNaN(date.getTime())) {
      return 'תאריך לא תקין';
    }
    
    // Format as DD.MM.YYYY
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  } catch (error) {
    return 'תאריך לא תקין';
  }
};

/**
 * Format coupon display text
 * @param {Object} coupon - Coupon object
 * @returns {string} Formatted text
 */
export const formatCouponDisplay = (coupon) => {
  if (coupon.discountType === COUPON_TYPES.PERCENTAGE) {
    return `${coupon.discountValue}% הנחה`;
  } else {
    return `הנחה ₪${coupon.discountValue}`;
  }
};

/**
 * Check if coupon is expired
 * @param {Object} coupon - Coupon object
 * @returns {boolean} True if expired
 */
export const isCouponExpired = (coupon) => {
  if (!coupon.expiryDate) return false;
  try {
    let expiryDate;
    // Handle both Firebase Timestamp objects and date strings
    if (coupon.expiryDate && typeof coupon.expiryDate === 'object' && coupon.expiryDate.toDate) {
      // Firebase Timestamp
      expiryDate = coupon.expiryDate.toDate();
    } else {
      // Date string
      expiryDate = new Date(coupon.expiryDate);
    }
    
    if (isNaN(expiryDate.getTime())) return false; // Invalid date, treat as not expired
    return expiryDate < new Date();
  } catch (error) {
    return false; // Error parsing date, treat as not expired
  }
};

/**
 * Get coupon status
 * @param {Object} coupon - Coupon object
 * @returns {string} Status
 */
export const getCouponStatus = (coupon) => {
  if (!coupon.isActive) {
    return COUPON_STATUS.INACTIVE;
  }
  
  if (isCouponExpired(coupon)) {
    return COUPON_STATUS.EXPIRED;
  }
  
  if (coupon.maxUsage && coupon.usageCount >= coupon.maxUsage) {
    return 'usage_limit_reached';
  }
  
  return COUPON_STATUS.ACTIVE;
};

/**
 * React Native Component Example for Coupon Input
 * 
 * import React, { useState } from 'react';
 * import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
 * import { validateCouponInApp, formatCouponDisplay } from './utils/reactNativeCouponUtils';
 * 
 * const CouponInput = ({ onCouponApplied, orderAmount, firebaseConfig }) => {
 *   const [couponCode, setCouponCode] = useState('');
 *   const [loading, setLoading] = useState(false);
 *   const [appliedCoupon, setAppliedCoupon] = useState(null);
 * 
 *   const handleApplyCoupon = async () => {
 *     if (!couponCode.trim()) {
 *       Alert.alert('خطأ', 'يرجى إدخال كود الكوبون');
 *       return;
 *     }
 * 
 *     setLoading(true);
 *     try {
 *       const result = await validateCouponInApp(couponCode.trim(), orderAmount, firebaseConfig);
 *       
 *       if (result.valid) {
 *         setAppliedCoupon(result.coupon);
 *         onCouponApplied(result.coupon);
 *         Alert.alert('نجح!', `تم تطبيق الكوبون: ${formatCouponDisplay(result.coupon)}`);
 *       } else {
 *         Alert.alert('خطأ', result.error);
 *       }
 *     } catch (error) {
 *       Alert.alert('خطأ', 'حدث خطأ أثناء التحقق من الكوبون');
 *     } finally {
 *       setLoading(false);
 *     }
 *   };
 * 
 *   const handleRemoveCoupon = () => {
 *     setAppliedCoupon(null);
 *     setCouponCode('');
 *     onCouponApplied(null);
 *   };
 * 
 *   return (
 *     <View style={{ marginVertical: 16 }}>
 *       <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>
 *         كود الخصم
 *       </Text>
 *       
 *       {appliedCoupon ? (
 *         <View style={{ 
 *           flexDirection: 'row', 
 *           justifyContent: 'space-between', 
 *           alignItems: 'center',
 *           backgroundColor: '#e8f5e8',
 *           padding: 12,
 *           borderRadius: 8,
 *           borderWidth: 1,
 *           borderColor: '#34C759'
 *         }}>
 *           <View>
 *             <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#34C759' }}>
 *               {appliedCoupon.code} - {formatCouponDisplay(appliedCoupon)}
 *             </Text>
 *             {appliedCoupon.description && (
 *               <Text style={{ fontSize: 14, color: '#666' }}>
 *                 {appliedCoupon.description}
 *               </Text>
 *             )}
 *           </View>
 *           <TouchableOpacity
 *             onPress={handleRemoveCoupon}
 *             style={{
 *               backgroundColor: '#FF3B30',
 *               paddingHorizontal: 12,
 *               paddingVertical: 6,
 *               borderRadius: 6
 *             }}
 *           >
 *             <Text style={{ color: 'white', fontWeight: 'bold' }}>إزالة</Text>
 *           </TouchableOpacity>
 *         </View>
 *       ) : (
 *         <View style={{ flexDirection: 'row', gap: 8 }}>
 *           <TextInput
 *             value={couponCode}
 *             onChangeText={setCouponCode}
 *             placeholder="أدخل كود الخصم"
 *             style={{
 *               flex: 1,
 *               borderWidth: 1,
 *               borderColor: '#ddd',
 *               borderRadius: 8,
 *               paddingHorizontal: 12,
 *               paddingVertical: 10,
 *               fontSize: 16
 *             }}
 *             autoCapitalize="characters"
 *           />
 *           <TouchableOpacity
 *             onPress={handleApplyCoupon}
 *             disabled={loading}
 *             style={{
 *               backgroundColor: '#007aff',
 *               paddingHorizontal: 16,
 *               paddingVertical: 10,
 *               borderRadius: 8,
 *               opacity: loading ? 0.6 : 1
 *             }}
 *           >
 *             <Text style={{ color: 'white', fontWeight: 'bold' }}>
 *               {loading ? 'جاري التحميل...' : 'تطبيق'}
 *             </Text>
 *           </TouchableOpacity>
 *         </View>
 *       )}
 *     </View>
 *   );
 * };
 * 
 * export default CouponInput;
 */
