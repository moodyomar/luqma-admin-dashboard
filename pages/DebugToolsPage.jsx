import React, { useState } from 'react';
import { useAuth } from '../src/contexts/AuthContext';
import { db } from '../firebase/firebaseConfig';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  writeBatch
} from 'firebase/firestore';
import { FiAlertTriangle, FiTrash2, FiRefreshCw, FiDatabase, FiCheckCircle } from 'react-icons/fi';
import brandConfig from '../constants/brandConfig';
import './styles.css';

const DebugToolsPage = () => {
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

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

  if (userRole !== 'admin') {
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
      const ordersRef = collection(db, 'menus', brandConfig.id, 'orders');
      const ordersSnapshot = await getDocs(ordersRef);
      
      let count = 0;
      const batchSize = 500;
      let batch = writeBatch(db);
      let batchCount = 0;

      for (const orderDoc of ordersSnapshot.docs) {
        const orderRef = doc(db, 'menus', brandConfig.id, 'orders', orderDoc.id);
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
        
        // Reset referral-related fields
        const updates = {};
        if (userData.referralCode !== undefined) {
          updates.referralCode = null;
        }
        if (userData.referredBy !== undefined) {
          updates.referredBy = null;
        }
        if (userData.referralStats !== undefined) {
          updates.referralStats = null;
        }

        if (Object.keys(updates).length > 0) {
          batch.update(userRef, updates);
          userCount++;
          batchCount++;
        }

        // Delete referral transactions subcollection
        try {
          const transactionsRef = collection(db, 'users', userDoc.id, 'referralTransactions');
          const transactionsSnapshot = await getDocs(transactionsRef);
          
          for (const transactionDoc of transactionsSnapshot.docs) {
            const transactionRef = doc(db, 'users', userDoc.id, 'referralTransactions', transactionDoc.id);
            batch.delete(transactionRef);
            transactionCount++;
            batchCount++;

            if (batchCount >= batchSize) {
              await batch.commit();
              batch = writeBatch(db);
              batchCount = 0;
            }
          }
        } catch (err) {
          console.warn(`Could not delete referral transactions for user ${userDoc.id}:`, err);
        }

        // Delete referral stats subcollection
        try {
          const statsRef = collection(db, 'users', userDoc.id, 'referralStats');
          const statsSnapshot = await getDocs(statsRef);
          
          for (const statDoc of statsSnapshot.docs) {
            const statRef = doc(db, 'users', userDoc.id, 'referralStats', statDoc.id);
            batch.delete(statRef);
            batchCount++;

            if (batchCount >= batchSize) {
              await batch.commit();
              batch = writeBatch(db);
              batchCount = 0;
            }
          }
        } catch (err) {
          console.warn(`Could not delete referral stats for user ${userDoc.id}:`, err);
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
      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersRef);
      
      let count = 0;
      const batchSize = 500;
      let batch = writeBatch(db);
      let batchCount = 0;

      for (const userDoc of usersSnapshot.docs) {
        const userRef = doc(db, 'users', userDoc.id);
        const userData = userDoc.data();
        
        const updates = {};
        if (userData.referralStats) {
          // Reset referral stats if it exists
          updates.referralStats = {
            totalReferrals: 0,
            totalEarned: 0
          };
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
      }

      if (batchCount > 0) {
        await batch.commit();
      }
      
      setResult({
        success: true,
        message: `✅ تم إعادة تعيين عدد الإحالات لـ ${count} مستخدم`
      });
    } catch (err) {
      console.error('Error resetting referral count:', err);
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
      const ordersRef = collection(db, 'menus', brandConfig.id, 'orders');
      const ordersSnapshot = await getDocs(ordersRef);
      
      let ordersBatch = writeBatch(db);
      let ordersBatchCount = 0;

      for (const orderDoc of ordersSnapshot.docs) {
        const orderRef = doc(db, 'menus', brandConfig.id, 'orders', orderDoc.id);
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
      
      // Reset referral data
      let referralBatch = writeBatch(db);
      let referralBatchCount = 0;
      let userCount = 0;
      let transactionCount = 0;

      for (const userDoc of usersSnapshot.docs) {
        const userRef = doc(db, 'users', userDoc.id);
        const userData = userDoc.data();
        
        const updates = {};
        if (userData.referralCode !== undefined) updates.referralCode = null;
        if (userData.referredBy !== undefined) updates.referredBy = null;
        if (userData.referralStats !== undefined) updates.referralStats = null;

        if (Object.keys(updates).length > 0) {
          referralBatch.update(userRef, updates);
          userCount++;
          referralBatchCount++;
        }

        // Delete referral transactions
        try {
          const transactionsRef = collection(db, 'users', userDoc.id, 'referralTransactions');
          const transactionsSnapshot = await getDocs(transactionsRef);
          
          for (const transactionDoc of transactionsSnapshot.docs) {
            const transactionRef = doc(db, 'users', userDoc.id, 'referralTransactions', transactionDoc.id);
            referralBatch.delete(transactionRef);
            transactionCount++;
            referralBatchCount++;

            if (referralBatchCount >= batchSize) {
              await referralBatch.commit();
              referralBatch = writeBatch(db);
              referralBatchCount = 0;
            }
          }
        } catch (err) {
          console.warn(`Could not delete referral transactions for user ${userDoc.id}:`, err);
        }

        if (referralBatchCount >= batchSize) {
          await referralBatch.commit();
          referralBatch = writeBatch(db);
          referralBatchCount = 0;
        }
      }

      if (referralBatchCount > 0) {
        await referralBatch.commit();
      }
      
      setResult({
        success: true,
        message: '✅ تم إعادة تعيين جميع البيانات بنجاح'
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
      description: 'يعيد تعيين إحصائيات الإحالة للمستخدمين',
      icon: FiDatabase,
      color: '#2196f3',
      action: resetReferralCount
    },
    {
      id: 'reset-referral-data',
      label: 'إعادة تعيين بيانات الإحالة',
      description: 'يحذف جميع بيانات الإحالة والمعاملات',
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

