// utils/couponUtils.js
import { db, auth } from '../firebase/firebaseConfig';
import { collection, doc, addDoc, updateDoc, deleteDoc, getDocs, query, where, orderBy, limit, increment } from 'firebase/firestore';
import brandConfig from '../constants/brandConfig';

/**
 * Force refresh Firebase Auth token to get latest custom claims
 * This ensures Firestore rules can access the latest businessIds and roles
 */
const refreshAuthToken = async () => {
  try {
    const user = auth.currentUser;
    if (user) {
      // Force refresh token to get latest custom claims
      const tokenResult = await user.getIdTokenResult(true);
      console.log('✅ Auth token refreshed');
      console.log('📋 Current token claims:', {
        businessIds: tokenResult.claims.businessIds,
        roles: tokenResult.claims.roles,
        uid: user.uid
      });
      
      // Verify claims for debugging
      const hasBusinessId = tokenResult.claims.businessIds && tokenResult.claims.businessIds.includes(brandConfig.id);
      const hasAdminRole = tokenResult.claims.roles && tokenResult.claims.roles.includes('admin');
      
      console.log(`🔍 Permission check for businessId "${brandConfig.id}":`, {
        hasBusinessId,
        hasAdminRole,
        willPass: hasBusinessId && hasAdminRole
      });
      
      if (!hasBusinessId || !hasAdminRole) {
        console.warn('⚠️ Token claims missing required permissions:', {
          businessIds: tokenResult.claims.businessIds,
          roles: tokenResult.claims.roles,
          requiredBusinessId: brandConfig.id,
          requiredRole: 'admin'
        });
      }
    } else {
      console.warn('⚠️ No authenticated user found');
    }
  } catch (error) {
    console.error('⚠️ Error refreshing auth token:', error);
    // Don't throw - continue with operation
  }
};

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
    // Refresh token to ensure latest custom claims are available
    await refreshAuthToken();
    
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
    // Provide user-friendly error message
    if (error.code === 'permission-denied') {
      throw new Error('אין לך הרשאה ליצור קופונים. אנא התנתק והתחבר מחדש או פנה למנהל המערכת.');
    }
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
 * @param {Object} updateData - Data to update (can use form field names or Firestore field names)
 * @returns {Promise<void>}
 */
export const updateCoupon = async (couponId, updateData) => {
  try {
    // Refresh token to ensure latest custom claims are available
    await refreshAuthToken();
    
    const couponRef = doc(db, 'menus', brandConfig.id, 'coupons', couponId);
    
    // Map form field names to Firestore field names (same as createCoupon)
    const mappedData = {};
    
    // Map code (if provided)
    if (updateData.code !== undefined) {
      mappedData.code = updateData.code.toUpperCase();
    }
    
    // Map type -> discountType
    if (updateData.type !== undefined) {
      mappedData.discountType = updateData.type;
    }
    // Also support direct discountType (for backward compatibility)
    if (updateData.discountType !== undefined) {
      mappedData.discountType = updateData.discountType;
    }
    
    // Map value -> discountValue
    if (updateData.value !== undefined) {
      mappedData.discountValue = parseFloat(updateData.value);
    }
    // Also support direct discountValue (for backward compatibility)
    if (updateData.discountValue !== undefined) {
      mappedData.discountValue = parseFloat(updateData.discountValue);
    }
    
    // Map minOrderAmount -> minimumOrder
    if (updateData.minOrderAmount !== undefined) {
      mappedData.minimumOrder = updateData.minOrderAmount ? parseFloat(updateData.minOrderAmount) : null;
    }
    // Also support direct minimumOrder
    if (updateData.minimumOrder !== undefined) {
      mappedData.minimumOrder = updateData.minimumOrder ? parseFloat(updateData.minimumOrder) : null;
    }
    
    // Map status -> isActive
    if (updateData.status !== undefined) {
      mappedData.isActive = updateData.status === COUPON_STATUS.ACTIVE;
    }
    // Also support direct isActive (for backward compatibility)
    if (updateData.isActive !== undefined) {
      mappedData.isActive = updateData.isActive;
    }
    
    // Map expiresAt -> expiryDate
    if (updateData.expiresAt !== undefined) {
      mappedData.expiryDate = updateData.expiresAt ? new Date(updateData.expiresAt) : null;
    }
    // Also support direct expiryDate
    if (updateData.expiryDate !== undefined) {
      mappedData.expiryDate = updateData.expiryDate ? new Date(updateData.expiryDate) : null;
    }
    
    // Map usageLimit -> maxUsage
    if (updateData.usageLimit !== undefined) {
      mappedData.maxUsage = updateData.usageLimit ? parseInt(updateData.usageLimit) : null;
    }
    // Also support direct maxUsage
    if (updateData.maxUsage !== undefined) {
      mappedData.maxUsage = updateData.maxUsage ? parseInt(updateData.maxUsage) : null;
    }
    
    // Map description (no mapping needed)
    if (updateData.description !== undefined) {
      mappedData.description = updateData.description || '';
    }
    
    // Map maxDiscountAmount (if used)
    if (updateData.maxDiscountAmount !== undefined) {
      mappedData.maxDiscountAmount = updateData.maxDiscountAmount ? parseFloat(updateData.maxDiscountAmount) : null;
    }
    
    // Preserve usageCount if explicitly provided (usually shouldn't be updated directly)
    if (updateData.usageCount !== undefined) {
      mappedData.usageCount = parseInt(updateData.usageCount);
    }
    
    await updateDoc(couponRef, {
      ...mappedData,
      updatedAt: new Date().toISOString()
    });
    
    console.log('✅ Coupon updated successfully:', {
      couponId,
      mappedData,
      originalUpdateData: updateData
    });
  } catch (error) {
    console.error('Error updating coupon:', error);
    // Provide user-friendly error message
    if (error.code === 'permission-denied') {
      throw new Error('אין לך הרשאה לעדכן קופונים. אנא התנתק והתחבר מחדש או פנה למנהל המערכת.');
    }
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
    // Refresh token to ensure latest custom claims are available
    await refreshAuthToken();
    
    const couponRef = doc(db, 'menus', brandConfig.id, 'coupons', couponId);
    await deleteDoc(couponRef);
  } catch (error) {
    console.error('Error deleting coupon:', error);
    // Provide user-friendly error message
    if (error.code === 'permission-denied') {
      throw new Error('אין לך הרשאה למחוק קופונים. אנא התנתק והתחבר מחדש או פנה למנהל המערכת.');
    }
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
