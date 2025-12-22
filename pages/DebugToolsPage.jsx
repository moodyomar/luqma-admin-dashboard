import React, { useState } from 'react';
import { useAuth } from '../src/contexts/AuthContext';
import { db, auth } from '../firebase/firebaseConfig';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  writeBatch,
  deleteDoc
} from 'firebase/firestore';
import { FiAlertTriangle, FiTrash2, FiRefreshCw, FiDatabase, FiCheckCircle } from 'react-icons/fi';
import './styles.css';

const DebugToolsPage = () => {
  const { userRole, activeBusinessId, isAdmin, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Helper function to refresh auth token before operations
  const refreshAuthToken = async () => {
    if (user) {
      try {
        const tokenResult = await user.getIdTokenResult(true); // Force refresh
        console.log('✅ Auth token refreshed');
        console.log('📋 Current claims:', {
          roles: tokenResult.claims.roles,
          businessIds: tokenResult.claims.businessIds,
          isAdmin: tokenResult.claims.roles?.includes('admin')
        });
        return tokenResult;
      } catch (err) {
        console.warn('⚠️ Could not refresh auth token:', err);
        throw err;
      }
    }
    return null;
  };

  // Only show in development mode
  const isDev = import.meta.env.DEV;

  if (!isDev) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#f8f9fa'
      }}>
        <div style={{
          textAlign: 'center',
          padding: '40px',
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
          maxWidth: '400px'
        }}>
          <FiAlertTriangle size={48} style={{ color: '#ffc107', marginBottom: '16px' }} />
          <h2 style={{ color: '#495057', marginBottom: '12px' }}>أدوات التطوير</h2>
          <p style={{ color: '#6c757d', margin: 0 }}>
            هذه الصفحة متاحة فقط في وضع التطوير
          </p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#f8f9fa'
      }}>
        <div style={{
          textAlign: 'center',
          padding: '40px',
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
          maxWidth: '400px'
        }}>
          <FiAlertTriangle size={48} style={{ color: '#dc3545', marginBottom: '16px' }} />
          <h2 style={{ color: '#495057', marginBottom: '12px' }}>غير مصرح</h2>
          <p style={{ color: '#6c757d', margin: 0 }}>
            يجب أن تكون مسؤولاً للوصول إلى أدوات التطوير
          </p>
        </div>
      </div>
    );
  }

  const confirmAction = (actionName) => {
    return window.confirm(
      `⚠️ تحذير: هذا الإجراء لا يمكن التراجع عنه!\n\n` +
      `هل أنت متأكد أنك تريد ${actionName}؟\n\n` +
      `اكتب "نعم" في مربع الحوار التالي للتأكيد.`
    );
  };

  const confirmWithText = () => {
    const text = window.prompt('اكتب "نعم" للتأكيد:');
    return text === 'نعم';
  };

  const resetUserPoints = async () => {
    if (!confirmAction('إعادة تعيين جميع نقاط المستخدمين')) return;
    if (!confirmWithText()) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersRef);
      
      let count = 0;
      const batchSize = 500;
      let batch = writeBatch(db);
      let batchCount = 0;

      for (const userDoc of usersSnapshot.docs) {
        const userRef = doc(db, 'users', userDoc.id);
        batch.update(userRef, { points: 0 });
        count++;
        batchCount++;

        if (batchCount >= batchSize) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }
      
      setResult({
        success: true,
        message: `✅ تم إعادة تعيين نقاط ${count} مستخدم بنجاح`
      });
    } catch (err) {
      console.error('Error resetting points:', err);
      setError(`❌ خطأ: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetAllOrders = async () => {
    if (!confirmAction('حذف جميع الطلبات')) return;
    if (!confirmWithText()) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      if (!activeBusinessId) {
        throw new Error('لا يوجد معرف عمل نشط');
      }
      
      const ordersRef = collection(db, 'menus', activeBusinessId, 'orders');
      const ordersSnapshot = await getDocs(ordersRef);
      
      let count = 0;
      const batchSize = 500;
      let batch = writeBatch(db);
      let batchCount = 0;

      for (const orderDoc of ordersSnapshot.docs) {
        const orderRef = doc(db, 'menus', activeBusinessId, 'orders', orderDoc.id);
        batch.delete(orderRef);
        count++;
        batchCount++;

        if (batchCount >= batchSize) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }
      
      setResult({
        success: true,
        message: `✅ تم حذف ${count} طلب بنجاح`
      });
    } catch (err) {
      console.error('Error deleting orders:', err);
      setError(`❌ خطأ: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetReferralData = async () => {
    if (!confirmAction('إعادة تعيين جميع بيانات الإحالة')) return;
    if (!confirmWithText()) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      // Refresh auth token to ensure latest permissions
      const tokenResult = await refreshAuthToken();
      if (!tokenResult) {
        throw new Error('Unable to refresh authentication token. Please sign out and sign back in.');
      }
      
      const hasAdminRole = tokenResult.claims.roles?.includes('admin');
      console.log('🔍 Admin role check:', {
        roles: tokenResult.claims.roles,
        hasAdminRole,
        businessIds: tokenResult.claims.businessIds
      });
      
      if (!hasAdminRole) {
        throw new Error('You must have admin role to perform this operation. Your current roles: ' + (tokenResult.claims.roles?.join(', ') || 'none'));
      }
      
      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersRef);
      
      let userCount = 0;
      let transactionCount = 0;
      const batchSize = 500;
      let batch = writeBatch(db);
      let batchCount = 0;

      // Reset referral fields in user documents
      for (const userDoc of usersSnapshot.docs) {
        const userRef = doc(db, 'users', userDoc.id);
        const userData = userDoc.data();
        
        // Reset referral-related fields (who referred this user)
        // NOTE: We do NOT reset referralCode (user's own code) - that should persist
        const updates = {};
        
        // Reset fields related to being referred by someone else
        if (userData.referredBy !== undefined && userData.referredBy !== null) {
          updates.referredBy = null;
        }
        if (userData.referredByUserId !== undefined && userData.referredByUserId !== null) {
          updates.referredByUserId = null;
        }
        if (userData.referredAt !== undefined && userData.referredAt !== null) {
          updates.referredAt = null;
        }
        if (userData.referralRewardAwarded !== undefined && userData.referralRewardAwarded !== null) {
          updates.referralRewardAwarded = null;
        }
        if (userData.referralRewardAmount !== undefined && userData.referralRewardAmount !== null) {
          updates.referralRewardAmount = null;
        }
        
        // Reset referral stats (count and rewards earned from referring others)
        if (userData.referralCount !== undefined && userData.referralCount !== null && userData.referralCount !== 0) {
          updates.referralCount = 0;
        }
        if (userData.referralRewards !== undefined && userData.referralRewards !== null && userData.referralRewards !== 0) {
          updates.referralRewards = 0;
        }
        if (userData.lastReferralAt !== undefined && userData.lastReferralAt !== null) {
          updates.lastReferralAt = null;
        }
        if (userData.lastReferralRewardAt !== undefined && userData.lastReferralRewardAt !== null) {
          updates.lastReferralRewardAt = null;
        }

        if (Object.keys(updates).length > 0) {
          batch.update(userRef, updates);
          userCount++;
          batchCount++;
        }

        // Delete referral transactions subcollection
        // Use individual deletes instead of batch to ensure proper permission evaluation
        try {
          const transactionsRef = collection(db, 'users', userDoc.id, 'referralTransactions');
          const transactionsSnapshot = await getDocs(transactionsRef);
          
          if (!transactionsSnapshot.empty) {
            for (const transactionDoc of transactionsSnapshot.docs) {
              try {
                const transactionRef = doc(db, 'users', userDoc.id, 'referralTransactions', transactionDoc.id);
                await deleteDoc(transactionRef);
                transactionCount++;
              } catch (deleteErr) {
                // Suppress errors for already-deleted or non-existent items
                // Only log unexpected errors
                const errorCode = deleteErr?.code || deleteErr?.message || '';
                if (!errorCode.includes('permission') && !errorCode.includes('not-found') && !errorCode.includes('not found')) {
                  console.warn(`⚠️ Could not delete transaction ${transactionDoc.id} for user ${userDoc.id}:`, deleteErr.message || deleteErr);
                }
                // Continue with other transactions
              }
            }
          }
        } catch (err) {
          // Suppress permission errors - data might already be cleared
          const errorCode = err?.code || err?.message || '';
          if (!errorCode.includes('permission') && !errorCode.includes('not-found') && !errorCode.includes('not found')) {
            console.warn(`⚠️ Could not access referral transactions for user ${userDoc.id}:`, err.message || err);
          }
          // Continue with other users
        }

        // Delete referral stats subcollection
        // Use individual deletes instead of batch to ensure proper permission evaluation
        try {
          const statsRef = collection(db, 'users', userDoc.id, 'referralStats');
          const statsSnapshot = await getDocs(statsRef);
          
          if (!statsSnapshot.empty) {
            for (const statDoc of statsSnapshot.docs) {
              try {
                const statRef = doc(db, 'users', userDoc.id, 'referralStats', statDoc.id);
                await deleteDoc(statRef);
              } catch (deleteErr) {
                // Suppress errors for already-deleted or non-existent items
                // Only log unexpected errors
                const errorCode = deleteErr?.code || deleteErr?.message || '';
                if (!errorCode.includes('permission') && !errorCode.includes('not-found') && !errorCode.includes('not found')) {
                  console.warn(`⚠️ Could not delete stat ${statDoc.id} for user ${userDoc.id}:`, deleteErr.message || deleteErr);
                }
                // Continue with other stats
              }
            }
          }
        } catch (err) {
          // Suppress permission errors - data might already be cleared
          const errorCode = err?.code || err?.message || '';
          if (!errorCode.includes('permission') && !errorCode.includes('not-found') && !errorCode.includes('not found')) {
            console.warn(`⚠️ Could not access referral stats for user ${userDoc.id}:`, err.message || err);
          }
          // Continue with other users
        }

        if (batchCount >= batchSize) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }
      
      setResult({
        success: true,
        message: `✅ تم إعادة تعيين بيانات الإحالة لـ ${userCount} مستخدم و ${transactionCount} معاملة`
      });
    } catch (err) {
      console.error('Error resetting referral data:', err);
      setError(`❌ خطأ: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetReferralCount = async () => {
    if (!confirmAction('إعادة تعيين عدد الإحالات')) return;
    if (!confirmWithText()) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      // Refresh auth token to ensure latest permissions
      const tokenResult = await refreshAuthToken();
      if (!tokenResult) {
        throw new Error('Unable to refresh authentication token. Please sign out and sign back in.');
      }
      
      const hasAdminRole = tokenResult.claims.roles?.includes('admin');
      if (!hasAdminRole) {
        throw new Error('You must have admin role to perform this operation.');
      }

      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersRef);
      
      let count = 0;
      let transactionCount = 0;
      const batchSize = 500;
      let batch = writeBatch(db);
      let batchCount = 0;

      for (const userDoc of usersSnapshot.docs) {
        const userRef = doc(db, 'users', userDoc.id);
        const userData = userDoc.data();
        
        const updates = {};
        // Reset referral count and rewards (stats for referring others)
        if (userData.referralCount !== undefined && userData.referralCount !== null && userData.referralCount !== 0) {
          updates.referralCount = 0;
        }
        if (userData.referralRewards !== undefined && userData.referralRewards !== null && userData.referralRewards !== 0) {
          updates.referralRewards = 0;
        }
        if (userData.lastReferralAt !== undefined && userData.lastReferralAt !== null) {
          updates.lastReferralAt = null;
        }
        if (userData.lastReferralRewardAt !== undefined && userData.lastReferralRewardAt !== null) {
          updates.lastReferralRewardAt = null;
        }

        if (Object.keys(updates).length > 0) {
          batch.update(userRef, updates);
          count++;
          batchCount++;

          if (batchCount >= batchSize) {
            await batch.commit();
            batch = writeBatch(db);
            batchCount = 0;
          }
        }

        // Delete referral transactions subcollection (clear transaction history)
        try {
          const transactionsRef = collection(db, 'users', userDoc.id, 'referralTransactions');
          const transactionsSnapshot = await getDocs(transactionsRef);
          
          if (!transactionsSnapshot.empty) {
            for (const transactionDoc of transactionsSnapshot.docs) {
              try {
                const transactionRef = doc(db, 'users', userDoc.id, 'referralTransactions', transactionDoc.id);
                await deleteDoc(transactionRef);
                transactionCount++;
              } catch (deleteErr) {
                const errorCode = deleteErr?.code || deleteErr?.message || '';
                if (!errorCode.includes('permission') && !errorCode.includes('not-found') && !errorCode.includes('not found')) {
                  console.warn(`⚠️ Could not delete transaction ${transactionDoc.id} for user ${userDoc.id}:`, deleteErr.message || deleteErr);
                }
              }
            }
          }
        } catch (err) {
          const errorCode = err?.code || err?.message || '';
          if (!errorCode.includes('permission') && !errorCode.includes('not-found') && !errorCode.includes('not found')) {
            console.warn(`⚠️ Could not access referral transactions for user ${userDoc.id}:`, err.message || err);
          }
        }

        // Delete referral stats subcollection (clear stats history)
        try {
          const statsRef = collection(db, 'users', userDoc.id, 'referralStats');
          const statsSnapshot = await getDocs(statsRef);
          
          if (!statsSnapshot.empty) {
            for (const statDoc of statsSnapshot.docs) {
              try {
                const statRef = doc(db, 'users', userDoc.id, 'referralStats', statDoc.id);
                await deleteDoc(statRef);
              } catch (deleteErr) {
                const errorCode = deleteErr?.code || deleteErr?.message || '';
                if (!errorCode.includes('permission') && !errorCode.includes('not-found') && !errorCode.includes('not found')) {
                  console.warn(`⚠️ Could not delete stat ${statDoc.id} for user ${userDoc.id}:`, deleteErr.message || deleteErr);
                }
              }
            }
          }
        } catch (err) {
          const errorCode = err?.code || err?.message || '';
          if (!errorCode.includes('permission') && !errorCode.includes('not-found') && !errorCode.includes('not found')) {
            console.warn(`⚠️ Could not access referral stats for user ${userDoc.id}:`, err.message || err);
          }
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }
      
      setResult({
        success: true,
        message: `✅ تم إعادة تعيين عدد الإحالات لـ ${count} مستخدم و حذف ${transactionCount} معاملة`
      });
    } catch (err) {
      console.error('Error resetting referral count:', err);
      setError(`❌ خطأ: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetSingleUserReferral = async () => {
    const userId = window.prompt('أدخل معرف المستخدم (User ID) لإعادة تعيين بيانات الإحالة:');
    if (!userId || !userId.trim()) {
      return;
    }

    if (!confirmAction(`إعادة تعيين بيانات الإحالة للمستخدم ${userId.trim()}`)) return;
    if (!confirmWithText()) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      // Refresh auth token to ensure latest permissions
      const tokenResult = await refreshAuthToken();
      if (!tokenResult) {
        throw new Error('Unable to refresh authentication token. Please sign out and sign back in.');
      }
      
      const hasAdminRole = tokenResult.claims.roles?.includes('admin');
      if (!hasAdminRole) {
        throw new Error('You must have admin role to perform this operation.');
      }

      const userRef = doc(db, 'users', userId.trim());
      const userDoc = await userRef.get();

      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      const updates = {};
      let transactionCount = 0;

      // Reset fields related to being referred by someone else
      if (userData.referredBy !== undefined && userData.referredBy !== null) {
        updates.referredBy = null;
      }
      if (userData.referredByUserId !== undefined && userData.referredByUserId !== null) {
        updates.referredByUserId = null;
      }
      if (userData.referredAt !== undefined && userData.referredAt !== null) {
        updates.referredAt = null;
      }
      if (userData.referralRewardAwarded !== undefined && userData.referralRewardAwarded !== null) {
        updates.referralRewardAwarded = null;
      }
      if (userData.referralRewardAmount !== undefined && userData.referralRewardAmount !== null) {
        updates.referralRewardAmount = null;
      }

      // Update user document
      if (Object.keys(updates).length > 0) {
        await updateDoc(userRef, updates);
      }

      // Delete referral transactions
      try {
        const transactionsRef = collection(db, 'users', userId.trim(), 'referralTransactions');
        const transactionsSnapshot = await getDocs(transactionsRef);
        
        for (const transactionDoc of transactionsSnapshot.docs) {
          try {
            const transactionRef = doc(db, 'users', userId.trim(), 'referralTransactions', transactionDoc.id);
            await deleteDoc(transactionRef);
            transactionCount++;
          } catch (deleteErr) {
            const errorCode = deleteErr?.code || deleteErr?.message || '';
            if (!errorCode.includes('permission') && !errorCode.includes('not-found') && !errorCode.includes('not found')) {
              console.warn(`⚠️ Could not delete transaction ${transactionDoc.id}:`, deleteErr.message || deleteErr);
            }
          }
        }
      } catch (err) {
        const errorCode = err?.code || err?.message || '';
        if (!errorCode.includes('permission') && !errorCode.includes('not-found') && !errorCode.includes('not found')) {
          console.warn(`⚠️ Could not access referral transactions:`, err.message || err);
        }
      }

      setResult({
        success: true,
        message: `✅ تم إعادة تعيين بيانات الإحالة للمستخدم ${userId.trim()} (${transactionCount} معاملة محذوفة)`
      });
    } catch (err) {
      console.error('Error resetting single user referral:', err);
      setError(`❌ خطأ: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetAllData = async () => {
    if (!confirmAction('إعادة تعيين جميع البيانات (الطلبات، النقاط، والإحالات)')) return;
    if (!confirmWithText()) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      // Refresh auth token to ensure latest permissions
      const tokenResult = await refreshAuthToken();
      if (!tokenResult) {
        throw new Error('Unable to refresh authentication token. Please sign out and sign back in.');
      }
      
      const hasAdminRole = tokenResult.claims.roles?.includes('admin');
      console.log('🔍 Admin role check:', {
        roles: tokenResult.claims.roles,
        hasAdminRole,
        businessIds: tokenResult.claims.businessIds
      });
      
      if (!hasAdminRole) {
        throw new Error('You must have admin role to perform this operation. Your current roles: ' + (tokenResult.claims.roles?.join(', ') || 'none'));
      }
      
      // Reset points
      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersRef);
      
      let pointsBatch = writeBatch(db);
      let pointsBatchCount = 0;
      const batchSize = 500;

      for (const userDoc of usersSnapshot.docs) {
        const userRef = doc(db, 'users', userDoc.id);
        pointsBatch.update(userRef, { points: 0 });
        pointsBatchCount++;

        if (pointsBatchCount >= batchSize) {
          await pointsBatch.commit();
          pointsBatch = writeBatch(db);
          pointsBatchCount = 0;
        }
      }
      if (pointsBatchCount > 0) {
        await pointsBatch.commit();
      }
      
      // Reset orders
      if (!activeBusinessId) {
        throw new Error('لا يوجد معرف عمل نشط');
      }
      
      const ordersRef = collection(db, 'menus', activeBusinessId, 'orders');
      const ordersSnapshot = await getDocs(ordersRef);
      
      let ordersBatch = writeBatch(db);
      let ordersBatchCount = 0;

      for (const orderDoc of ordersSnapshot.docs) {
        const orderRef = doc(db, 'menus', activeBusinessId, 'orders', orderDoc.id);
        ordersBatch.delete(orderRef);
        ordersBatchCount++;

        if (ordersBatchCount >= batchSize) {
          await ordersBatch.commit();
          ordersBatch = writeBatch(db);
          ordersBatchCount = 0;
        }
      }
      if (ordersBatchCount > 0) {
        await ordersBatch.commit();
      }
      
      // Reset referral data - FIRST delete all transactions/stats, THEN update user documents
      // Get fresh snapshot for referral operations
      console.log('📋 Getting users snapshot for referral reset...');
      let referralUsersSnapshot;
      try {
        referralUsersSnapshot = await getDocs(collection(db, 'users'));
        console.log(`📋 Found ${referralUsersSnapshot.docs.length} users`);
      } catch (err) {
        console.error('❌ Error getting users snapshot:', err);
        throw new Error(`Failed to get users: ${err.message}`);
      }
      
      let transactionCount = 0;
      let statsCount = 0;

      // STEP 1: Delete all referral transactions and stats first (complete this before batch updates)
      console.log('🗑️ Step 1: Deleting referral transactions and stats...');
      try {
        for (const userDoc of referralUsersSnapshot.docs) {
          const userId = userDoc.id;
        // Delete referral transactions
        try {
          const transactionsRef = collection(db, 'users', userId, 'referralTransactions');
          const transactionsSnapshot = await getDocs(transactionsRef);
          
          if (!transactionsSnapshot.empty) {
            console.log(`  🗑️ Deleting ${transactionsSnapshot.docs.length} transactions for user ${userId}`);
            for (const transactionDoc of transactionsSnapshot.docs) {
              try {
                const transactionRef = doc(db, 'users', userId, 'referralTransactions', transactionDoc.id);
                await deleteDoc(transactionRef);
                transactionCount++;
              } catch (deleteErr) {
                // Log permission errors but don't throw - continue with other deletions
                const errorCode = deleteErr?.code || deleteErr?.message || '';
                if (errorCode.includes('permission')) {
                  console.error(`❌ Permission denied deleting transaction ${transactionDoc.id} for user ${userId}:`, deleteErr);
                  throw deleteErr; // Re-throw permission errors to see them
                } else if (!errorCode.includes('not-found') && !errorCode.includes('not found')) {
                  console.warn(`⚠️ Could not delete transaction ${transactionDoc.id} for user ${userId}:`, deleteErr.message || deleteErr);
                }
              }
            }
          }
        } catch (err) {
          const errorCode = err?.code || err?.message || '';
          if (errorCode.includes('permission')) {
            console.error(`❌ Permission error accessing referral transactions for user ${userId}:`, err);
            throw err; // Re-throw permission errors
          } else if (!errorCode.includes('not-found') && !errorCode.includes('not found')) {
            console.warn(`⚠️ Could not access referral transactions for user ${userId}:`, err.message || err);
          }
        }

        // Delete referral stats
        try {
          const statsRef = collection(db, 'users', userId, 'referralStats');
          const statsSnapshot = await getDocs(statsRef);
          
          if (!statsSnapshot.empty) {
            console.log(`  🗑️ Deleting ${statsSnapshot.docs.length} stats for user ${userId}`);
            for (const statDoc of statsSnapshot.docs) {
              try {
                const statRef = doc(db, 'users', userId, 'referralStats', statDoc.id);
                await deleteDoc(statRef);
                statsCount++;
              } catch (deleteErr) {
                const errorCode = deleteErr?.code || deleteErr?.message || '';
                if (errorCode.includes('permission')) {
                  console.error(`❌ Permission denied deleting stat ${statDoc.id} for user ${userId}:`, deleteErr);
                  throw deleteErr; // Re-throw permission errors
                } else if (!errorCode.includes('not-found') && !errorCode.includes('not found')) {
                  console.warn(`⚠️ Could not delete stat ${statDoc.id} for user ${userId}:`, deleteErr.message || deleteErr);
                }
              }
            }
          }
        } catch (err) {
          const errorCode = err?.code || err?.message || '';
          if (errorCode.includes('permission')) {
            console.error(`❌ Permission error accessing referral stats for user ${userId}:`, err);
            throw err; // Re-throw permission errors
          } else if (!errorCode.includes('not-found') && !errorCode.includes('not found')) {
            console.warn(`⚠️ Could not access referral stats for user ${userId}:`, err.message || err);
          }
        }
        } // Close for loop
      } catch (err) {
        console.error('❌ Error during transaction/stats deletion:', err);
        // Continue anyway - we'll try to update user documents
        console.warn('⚠️ Continuing with user document updates despite deletion errors...');
      }

      console.log(`✅ Deleted ${transactionCount} transactions and ${statsCount} stats`);

      // STEP 2: Now update user documents with batch operations
      console.log('📝 Step 2: Updating user documents...');
      let referralBatch = writeBatch(db);
      let referralBatchCount = 0;
      let userCount = 0;

      try {
        for (const userDoc of referralUsersSnapshot.docs) {
          const userId = userDoc.id;
          const userRef = doc(db, 'users', userId);
          const userData = userDoc.data();
        
        // Reset referral-related fields (who referred this user)
        // NOTE: We do NOT reset referralCode (user's own code) - that should persist
        const updates = {};
        
        // Reset fields related to being referred by someone else
        if (userData.referredBy !== undefined && userData.referredBy !== null) {
          updates.referredBy = null;
        }
        if (userData.referredByUserId !== undefined && userData.referredByUserId !== null) {
          updates.referredByUserId = null;
        }
        if (userData.referredAt !== undefined && userData.referredAt !== null) {
          updates.referredAt = null;
        }
        if (userData.referralRewardAwarded !== undefined && userData.referralRewardAwarded !== null) {
          updates.referralRewardAwarded = null;
        }
        if (userData.referralRewardAmount !== undefined && userData.referralRewardAmount !== null) {
          updates.referralRewardAmount = null;
        }
        
        // Reset referral stats (count and rewards earned from referring others)
        if (userData.referralCount !== undefined && userData.referralCount !== null && userData.referralCount !== 0) {
          updates.referralCount = 0;
        }
        if (userData.referralRewards !== undefined && userData.referralRewards !== null && userData.referralRewards !== 0) {
          updates.referralRewards = 0;
        }
        if (userData.lastReferralAt !== undefined && userData.lastReferralAt !== null) {
          updates.lastReferralAt = null;
        }
        if (userData.lastReferralRewardAt !== undefined && userData.lastReferralRewardAt !== null) {
          updates.lastReferralRewardAt = null;
        }

        if (Object.keys(updates).length > 0) {
          referralBatch.update(userRef, updates);
          userCount++;
          referralBatchCount++;

          if (referralBatchCount >= batchSize) {
            await referralBatch.commit();
            referralBatch = writeBatch(db);
            referralBatchCount = 0;
          }
        }
        } // Close for loop

        // Commit any remaining batch updates
        if (referralBatchCount > 0) {
          console.log(`📝 Committing final batch of ${referralBatchCount} user updates...`);
          await referralBatch.commit();
          console.log('✅ Final batch committed successfully');
        }
        
        console.log(`✅ Updated ${userCount} user documents`);
      } catch (err) {
        console.error('❌ Error during user document updates:', err);
        console.error('Error details:', {
          code: err?.code,
          message: err?.message,
          stack: err?.stack
        });
        throw err; // Re-throw to show in UI
      }
      
      setResult({
        success: true,
        message: `✅ تم إعادة تعيين جميع البيانات بنجاح (${userCount} مستخدم، ${transactionCount} معاملة)`
      });
    } catch (err) {
      console.error('Error resetting all data:', err);
      setError(`❌ خطأ: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const actions = [
    {
      id: 'reset-points',
      label: 'إعادة تعيين نقاط المستخدمين',
      description: 'يعيد تعيين جميع نقاط المستخدمين إلى 0',
      icon: FiRefreshCw,
      color: '#ff9800',
      action: resetUserPoints
    },
    {
      id: 'reset-orders',
      label: 'حذف جميع الطلبات',
      description: 'يحذف جميع الطلبات من قاعدة البيانات',
      icon: FiTrash2,
      color: '#f44336',
      action: resetAllOrders
    },
    {
      id: 'reset-referral-count',
      label: 'إعادة تعيين عدد الإحالات',
      description: 'يعيد تعيين إحصائيات الإحالة للمستخدمين (referralCount, referralRewards)',
      icon: FiDatabase,
      color: '#2196f3',
      action: resetReferralCount
    },
    {
      id: 'reset-single-user-referral',
      label: 'إعادة تعيين إحالة مستخدم واحد',
      description: 'يعيد تعيين بيانات الإحالة لمستخدم محدد (referredBy, referredByUserId, etc.)',
      icon: FiRefreshCw,
      color: '#9c27b0',
      action: resetSingleUserReferral
    },
    {
      id: 'reset-referral-data',
      label: 'إعادة تعيين بيانات الإحالة (الكل)',
      description: 'يحذف جميع بيانات الإحالة والمعاملات لجميع المستخدمين',
      icon: FiTrash2,
      color: '#9c27b0',
      action: resetReferralData
    },
    {
      id: 'reset-all',
      label: 'إعادة تعيين جميع البيانات',
      description: 'يحذف جميع الطلبات والنقاط وبيانات الإحالة',
      icon: FiAlertTriangle,
      color: '#d32f2f',
      action: resetAllData
    }
  ];

  return (
    <div style={{
      padding: '24px',
      maxWidth: '1200px',
      margin: '0 auto',
      backgroundColor: '#f8f9fa',
      minHeight: '100vh'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '32px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        marginBottom: '24px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '8px'
        }}>
          <FiAlertTriangle size={24} style={{ color: '#ff9800' }} />
          <h1 style={{
            margin: 0,
            fontSize: '28px',
            fontWeight: 'bold',
            color: '#333'
          }}>
            أدوات التطوير
          </h1>
        </div>
        <p style={{
          margin: '8px 0 0 0',
          color: '#666',
          fontSize: '14px'
        }}>
          ⚠️ تحذير: هذه الأدوات تقوم بإجراءات لا يمكن التراجع عنها. استخدمها بحذر!
        </p>
      </div>

      {result && (
        <div style={{
          backgroundColor: result.success ? '#e8f5e9' : '#ffebee',
          border: `1px solid ${result.success ? '#4caf50' : '#f44336'}`,
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          {result.success ? (
            <FiCheckCircle size={20} style={{ color: '#4caf50' }} />
          ) : (
            <FiAlertTriangle size={20} style={{ color: '#f44336' }} />
          )}
          <span style={{
            color: result.success ? '#2e7d32' : '#c62828',
            fontSize: '14px',
            fontWeight: 500
          }}>
            {result.message}
          </span>
        </div>
      )}

      {error && (
        <div style={{
          backgroundColor: '#ffebee',
          border: '1px solid #f44336',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <FiAlertTriangle size={20} style={{ color: '#f44336' }} />
          <span style={{
            color: '#c62828',
            fontSize: '14px',
            fontWeight: 500
          }}>
            {error}
          </span>
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: '20px'
      }}>
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <div
              key={action.id}
              style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '24px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                border: `2px solid ${action.color}20`,
                transition: 'all 0.2s',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1
              }}
              onClick={() => !loading && action.action()}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '12px'
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: `${action.color}20`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Icon size={24} style={{ color: action.color }} />
                </div>
                <h3 style={{
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: '#333'
                }}>
                  {action.label}
                </h3>
              </div>
              <p style={{
                margin: 0,
                fontSize: '14px',
                color: '#666',
                lineHeight: '1.5'
              }}>
                {action.description}
              </p>
              {loading && (
                <div style={{
                  marginTop: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: action.color
                }}>
                  <FiRefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: '12px' }}>جاري المعالجة...</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default DebugToolsPage;

