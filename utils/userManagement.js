import { db } from '../firebase/firebaseConfig';
import { doc, setDoc, getDoc } from 'firebase/firestore';

/**
 * Create or update a user's role in Firestore
 * @param {string} userId - Firebase Auth UID
 * @param {string} role - 'admin' or 'driver'
 * @param {object} additionalData - Additional user data
 */
export const createOrUpdateUser = async (userId, role, additionalData = {}) => {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...additionalData
    }, { merge: true });
    
    console.log(`✅ User ${userId} created/updated with role: ${role}`);
    return true;
  } catch (error) {
    console.error('❌ Error creating/updating user:', error);
    return false;
  }
};

/**
 * Get user data from Firestore
 * @param {string} userId - Firebase Auth UID
 */
export const getUserData = async (userId) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      return userDoc.data();
    } else {
      return null;
    }
  } catch (error) {
    console.error('❌ Error fetching user data:', error);
    return null;
  }
};

/**
 * Check if user has specific role
 * @param {string} userId - Firebase Auth UID
 * @param {string} role - Role to check
 */
export const hasRole = async (userId, role) => {
  const userData = await getUserData(userId);
  return userData?.role === role;
};

/**
 * Get all users with a specific role
 * @param {string} role - Role to filter by
 */
export const getUsersByRole = async (role) => {
  // Note: This would require a Firestore query with role index
  // For now, this is a placeholder for future implementation
  console.log(`Getting users with role: ${role}`);
  return [];
}; 