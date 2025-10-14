import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase/firebaseConfig';
import { deleteUser as firebaseDeleteUser } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../src/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import './styles.css';
import { FiLogOut, FiUser, FiMail, FiTrash2, FiPhone } from 'react-icons/fi';

const UserManagementPage = () => {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: ''
  });
  const { userRole, activeBusinessId } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (userRole !== 'admin') {
      navigate('/meals');
      return;
    }
    if (activeBusinessId) {
      fetchDrivers();
    }
  }, [userRole, navigate, activeBusinessId]);

  const fetchDrivers = async () => {
    if (!activeBusinessId) return;
    
    try {
      // Use correct Firestore path according to rules: /menus/{businessId}/users/{uid}
      const usersRef = collection(db, 'menus', activeBusinessId, 'users');
      const snapshot = await getDocs(usersRef);
      const driverUsers = [];
      
      snapshot.forEach(doc => {
        const userData = doc.data();
        if (userData.role === 'driver') {
          driverUsers.push({
            id: doc.id,
            ...userData
          });
        }
      });
      
      setDrivers(driverUsers);
    } catch (error) {
      console.error('Error fetching drivers:', error);
      // Set empty array on error to prevent UI issues
      setDrivers([]);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCreateDriver = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Use callable cloud function to create or attach driver and set claims
      const functions = getFunctions();
      const inviteUser = httpsCallable(functions, 'inviteUser');
      const result = await inviteUser({
        businessId: activeBusinessId,
        email: formData.email.trim(),
        role: 'driver',
        displayName: formData.name?.trim() || undefined,
      });

      const { uid } = result.data || {};

      // Create or update Firestore membership document (defensive; function also writes it)
      if (uid) {
        await setDoc(doc(db, 'menus', activeBusinessId, 'users', uid), {
          role: 'driver',
          email: formData.email,
          name: formData.name,
          phone: formData.phone,
          createdAt: new Date().toISOString(),
          createdBy: auth.currentUser.uid,
          businessId: activeBusinessId
        }, { merge: true });
      }

      // Reset form
      setFormData({
        email: '',
        password: '',
        name: '',
        phone: ''
      });

      // Refresh drivers list
      await fetchDrivers();
      
      alert('✅ تم إنشاء/ربط حساب السائق بنجاح!');
    } catch (error) {
      console.error('Error creating driver:', error);
      const msg = error?.message || '';
      // Friendlier messages
      if (msg.includes('permission-denied')) {
        alert('❌ لا تملك صلاحية لإضافة سائقين لهذا العمل.');
      } else if (msg.includes('already')) {
        alert('ℹ️ البريد مستخدم مسبقاً، تم محاولة ربطه بالعمل الحالي.');
      } else {
        alert(`❌ خطأ في إنشاء الحساب: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Delete driver from Firestore and Firebase Auth
  const handleDeleteDriver = async (driverId) => {
    if (!window.confirm('هل أنت متأكد أنك تريد حذف هذا السائق؟')) return;
    try {
      // Delete from Firestore - using correct path
      await deleteDoc(doc(db, 'menus', activeBusinessId, 'users', driverId));
      // Optionally, delete from Firebase Auth (requires admin SDK in backend for full security)
      // If you want to delete from Auth here, you must be logged in as that user, which is not practical for admin panel.
      // So, we only delete from Firestore here.
      await fetchDrivers();
      alert('تم حذف السائق بنجاح.');
    } catch (error) {
      alert('حدث خطأ أثناء حذف السائق.');
      console.error('Error deleting driver:', error);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  // Helper to format date in en-IL
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const dateObj = new Date(dateString);
    if (!isNaN(dateObj)) {
      return dateObj.toLocaleDateString('en-IL', { year: 'numeric', month: '2-digit', day: '2-digit' });
    }
    return dateString;
  };

  return (
    <div style={{ 
      padding: window.innerWidth < 768 ? '8px' : '16px', 
      paddingBottom: window.innerWidth < 768 ? '100px' : '16px', // Space for mobile bottom nav
      maxWidth: 800, 
      margin: '0 auto', 
      position: 'relative' 
    }}>

      {/* Create Driver Form */}
      <div style={{ 
        background: '#f8f9fa', 
        padding: 20, 
        borderRadius: 8, 
        marginBottom: 30,
        border: '1px solid #dee2e6'
      }}>
        <h3 style={{ marginTop: 0, marginBottom: 20, color: '#495057' }}>
          إضافة سائق جديد
        </h3>
        
        <form onSubmit={handleCreateDriver}>
          <div
            className="driver-form-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gridTemplateRows: '1fr 1fr',
              gap: 15,
              maxWidth: 400,
              width: '100%',
              margin: '0 auto',
            }}
          >
            <input
              type="email"
              placeholder="البريد الإلكتروني"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              required
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px',
                borderRadius: 6,
                border: '1px solid #ced4da',
              }}
            />
            <input
              type="password"
              placeholder="كلمة المرور"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              required
              minLength={6}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px',
                borderRadius: 6,
                border: '1px solid #ced4da',
              }}
            />
            <input
              type="text"
              placeholder="اسم السائق"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              required
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px',
                borderRadius: 6,
                border: '1px solid #ced4da',
              }}
            />
            <input
              type="tel"
              placeholder="رقم الهاتف"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px',
                borderRadius: 6,
                border: '1px solid #ced4da',
              }}
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 15,
              padding: '12px 24px',
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 16,
              fontWeight: 600,
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'جاري الإنشاء...' : 'إضافة سائق'}
          </button>
        </form>
      </div>

      {/* Drivers List */}
      <div style={{ 
        background: 'white', 
        padding: 20, 
        borderRadius: 8,
        border: '1px solid #dee2e6'
      }}>
        <h3 style={{ marginTop: 0, marginBottom: 20, color: '#495057' }}>
          السائقين المسجلين ({drivers.length})
        </h3>
        
        {drivers.length === 0 ? (
          <p style={{ color: '#6c757d', textAlign: 'center', fontStyle: 'italic' }}>
            لا يوجد سائقين مسجلين حالياً
          </p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {drivers.map((driver) => (
              <div
                key={driver.id}
                style={{
                  padding: 15,
                  border: '1px solid #e9ecef',
                  borderRadius: 6,
                  background: '#f8f9fa',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', fontWeight: 600, color: '#495057', fontSize: 18, gap: 6 }}>
                    <FiUser style={{ marginLeft: 2 }} />
                    {driver.name || 'بدون اسم'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', fontSize: 14, color: '#6c757d', gap: 6 }}>
                    <FiMail style={{ marginLeft: 2 }} />
                    {driver.email}
                  </div>
                  {driver.phone && (
                    <div style={{ fontSize: 14, color: '#6c757d', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <FiPhone style={{ marginLeft: 2 }} />
                      {driver.phone}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                  <div style={{ fontSize: 12, color: '#6c757d' }}>
                    {formatDate(driver.createdAt)}
                  </div>
                  <button
                    onClick={() => handleDeleteDriver(driver.id)}
                    style={{
                      background: '#dc3545',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '6px 10px',
                      cursor: 'pointer',
                      fontSize: 16,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                    title="حذف السائق"
                  >
                    <FiTrash2 /> حذف
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{ 
        marginTop: 30, 
        display: 'flex', 
        gap: 10, 
        justifyContent: 'center' 
      }}>
        <button
          onClick={() => navigate('/meals')}
          style={{
            padding: '10px 20px',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 14
          }}
        >
          العودة لإدارة الوجبات
        </button>
        <button
          onClick={() => navigate('/orders')}
          style={{
            padding: '10px 20px',
            background: '#17a2b8',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 14
          }}
        >
          عرض الطلبات
        </button>
      </div>
    </div>
  );
};

export default UserManagementPage; 