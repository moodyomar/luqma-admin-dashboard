import { collection, doc } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

/**
 * Get a reference to a business document
 * @param {string} businessId - The business ID
 * @returns {DocumentReference}
 */
export function getBusinessRef(businessId) {
  return doc(db, 'menus', businessId);
}

/**
 * Get a reference to a tenant-scoped collection
 * @param {string} businessId - The business ID
 * @param {string} collectionName - The collection name (e.g., 'orders', 'products', 'users')
 * @returns {CollectionReference}
 */
export function getTenantCollection(businessId, collectionName) {
  return collection(db, 'menus', businessId, collectionName);
}

/**
 * Get a reference to a tenant-scoped document
 * @param {string} businessId - The business ID
 * @param {string} collectionName - The collection name
 * @param {string} docId - The document ID
 * @returns {DocumentReference}
 */
export function getTenantDoc(businessId, collectionName, docId) {
  return doc(db, 'menus', businessId, collectionName, docId);
}

/**
 * Helper to get all common tenant collections
 * @param {string} businessId - The business ID
 * @returns {Object} Object containing collection references
 */
export function getTenantCollections(businessId) {
  return {
    orders: getTenantCollection(businessId, 'orders'),
    products: getTenantCollection(businessId, 'products'),
    categories: getTenantCollection(businessId, 'categories'),
    users: getTenantCollection(businessId, 'users'),
    coupons: getTenantCollection(businessId, 'coupons'),
    drivers: getTenantCollection(businessId, 'drivers'),
    media: getTenantCollection(businessId, 'media'),
    analytics: getTenantCollection(businessId, 'analytics'),
    notifications: getTenantCollection(businessId, 'notifications'),
  };
}

/**
 * Migration helper: Check if a path is tenant-scoped
 * @param {string} path - Firestore path
 * @returns {boolean}
 */
export function isTenantScoped(path) {
  return path.startsWith('menus/') && path.split('/').length >= 3;
}

/**
 * Migration helper: Convert legacy path to tenant-scoped path
 * @param {string} legacyPath - Legacy path (e.g., 'orders/123')
 * @param {string} businessId - Business ID to scope to
 * @returns {string} Tenant-scoped path (e.g., 'menus/luqma/orders/123')
 */
export function convertToTenantPath(legacyPath, businessId) {
  if (isTenantScoped(legacyPath)) {
    return legacyPath; // Already scoped
  }
  return `menus/${businessId}/${legacyPath}`;
}



