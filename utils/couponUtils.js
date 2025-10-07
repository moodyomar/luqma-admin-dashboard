// utils/couponUtils.js
import { db } from '../firebase/firebaseConfig';
import { collection, doc, addDoc, updateDoc, deleteDoc, getDocs, query, where, orderBy, limit, increment } from 'firebase/firestore';
import brandConfig from '../constants/brandConfig';

/**
 * Coupon Types
 */
export const COUPON_TYPES = {
  PERCENTAGE: 'percentage',
  FIXED_AMOUNT: 'fixed_amount'
};

/**
 * Field name mappings to match your specifications
 */
export const COUPON_FIELD_MAPPING = {
  code: 'code',
  discountType: 'type',
  discountValue: 'value',
  minimumOrder: 'minOrderAmount',
  isActive: 'status',
  expiryDate: 'expiresAt',
  usageCount: 'usageCount',
  maxUsage: 'usageLimit',
  description: 'description',
  createdAt: 'createdAt'
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
 * Generate a random coupon code
 * @param {number} length - Length of the coupon code (default: 8)
 * @returns {string} Generated coupon code
 */
export const generateCouponCode = (length = 8) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Create a new coupon
 * @param {Object} couponData - Coupon data
 * @returns {Promise<string>} Document ID of created coupon
 */
export const createCoupon = async (couponData) => {
  try {
    const couponRef = collection(db, 'menus', brandConfig.id, 'coupons');
    
    // Map to your exact field specifications
    const coupon = {
      code: couponData.code.toUpperCase(),
      discountType: couponData.type,
      discountValue: couponData.value,
      minimumOrder: couponData.minOrderAmount || null,
      isActive: couponData.status === COUPON_STATUS.ACTIVE,
      expiryDate: couponData.expiresAt ? new Date(couponData.expiresAt) : null,
      usageCount: 0,
      maxUsage: couponData.usageLimit || null,
      description: couponData.description || '',
      createdAt: new Date()
    };
    
    const docRef = await addDoc(couponRef, coupon);
    return docRef.id;
  } catch (error) {
    console.error('Error creating coupon:', error);
    throw error;
  }
};

/**
 * Get all coupons
 * @param {string} status - Filter by status (optional)
 * @returns {Promise<Array>} Array of coupons
 */
export const getAllCoupons = async (status = null) => {
  try {
    const couponsRef = collection(db, 'menus', brandConfig.id, 'coupons');
    let q = query(couponsRef, orderBy('createdAt', 'desc'));
    
    if (status) {
      q = query(couponsRef, where('status', '==', status), orderBy('createdAt', 'desc'));
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting coupons:', error);
    throw error;
  }
};

/**
 * Get a specific coupon by code
 * @param {string} code - Coupon code
 * @returns {Promise<Object|null>} Coupon data or null if not found
 */
export const getCouponByCode = async (code) => {
  try {
    const couponsRef = collection(db, 'menus', brandConfig.id, 'coupons');
    const q = query(couponsRef, where('code', '==', code.toUpperCase()));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return null;
    }
    
    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data()
    };
  } catch (error) {
    console.error('Error getting coupon by code:', error);
    throw error;
  }
};

/**
 * Update a coupon
 * @param {string} couponId - Coupon document ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<void>}
 */
export const updateCoupon = async (couponId, updateData) => {
  try {
    const couponRef = doc(db, 'menus', brandConfig.id, 'coupons', couponId);
    await updateDoc(couponRef, {
      ...updateData,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating coupon:', error);
    throw error;
  }
};

/**
 * Delete a coupon
 * @param {string} couponId - Coupon document ID
 * @returns {Promise<void>}
 */
export const deleteCoupon = async (couponId) => {
  try {
    const couponRef = doc(db, 'menus', brandConfig.id, 'coupons', couponId);
    await deleteDoc(couponRef);
  } catch (error) {
    console.error('Error deleting coupon:', error);
    throw error;
  }
};

/**
 * Validate a coupon
 * @param {string} code - Coupon code
 * @param {number} orderAmount - Order total amount
 * @returns {Promise<Object>} Validation result
 */
export const validateCoupon = async (code, orderAmount = 0) => {
  try {
    const coupon = await getCouponByCode(code);
    
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
 * Apply a coupon (increment usage count)
 * @param {string} couponId - Coupon document ID
 * @returns {Promise<void>}
 */
export const applyCoupon = async (couponId) => {
  try {
    const couponRef = doc(db, 'menus', brandConfig.id, 'coupons', couponId);
    await updateDoc(couponRef, {
      usageCount: increment(1),
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error applying coupon:', error);
    throw error;
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
