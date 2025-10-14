import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase/firebaseConfig';
import { deleteUser as firebaseDeleteUser } from 'firebase/auth';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { firebaseApp } from '../firebase/firebaseConfig';
import { doc, setDoc, collection, getDocs, deleteDoc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../src/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import './styles.css';
import { FiLogOut, FiUser, FiMail, FiTrash2, FiPhone } from 'react-icons/fi';

const UserManagementPage = () => {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deletingDriver, setDeletingDriver] = useState(null); // Track which driver is being deleted
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
    if (!activeBusinessId) return;

    // Real-time sync with Firestore membership collection
    const usersRef = collection(db, 'menus', activeBusinessId, 'users');
    const unsubscribe = onSnapshot(usersRef, (snapshot) => {
      const driverUsers = [];
      snapshot.forEach((docSnap) => {
        const userData = docSnap.data();
        if (userData.role === 'driver') {
          driverUsers.push({ id: docSnap.id, ...userData });
        }
      });
      setDrivers(driverUsers);
    }, (error) => {
      console.error('Error listening to drivers:', error);
      setDrivers([]);
    });

    return () => unsubscribe();
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
      const functions = getFunctions(firebaseApp, import.meta.env.VITE_FIREBASE_REGION || 'us-central1');
      // Ensure correct origin in local/dev to avoid manual fetch to URL and CORS
      if (import.meta.env.DEV && import.meta.env.VITE_USE_FUNCTIONS_EMULATOR === 'true') {
        connectFunctionsEmulator(functions, 'localhost', 5001);
      }
      const inviteUser = httpsCallable(functions, 'inviteUser');
      // Format phone number to E.164 if provided
      let formattedPhone = undefined;
      if (formData.phone?.trim()) {
        const phone = formData.phone.trim();
        // If it starts with 0, replace with +972 (Israel country code)
        if (phone.startsWith('0')) {
          formattedPhone = '+972' + phone.substring(1);
        } else if (!phone.startsWith('+')) {
          // If no country code, assume Israel
          formattedPhone = '+972' + phone;
        } else {
          formattedPhone = phone;
        }
      }

      const result = await inviteUser({
        businessId: activeBusinessId,
        email: formData.email.trim(),
        password: formData.password, // Send the password
        role: 'driver',
        displayName: formData.name?.trim() || undefined,
        phone: formattedPhone, // Send formatted phone or undefined
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

      // Drivers list will auto-refresh via real-time listener
      
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

  // Delete driver via Cloud Function (ensures permissions and claims cleanup)
  const handleDeleteDriver = async (driverId) => {
    if (!window.confirm('هل أنت متأكد أنك تريد حذف هذا السائق؟')) return;
    
    setDeletingDriver(driverId); // Set loading state
    try {
      const functions = getFunctions(firebaseApp, import.meta.env.VITE_FIREBASE_REGION || 'us-central1');
      if (import.meta.env.DEV && import.meta.env.VITE_USE_FUNCTIONS_EMULATOR === 'true') {
        connectFunctionsEmulator(functions, 'localhost', 5001);
      }
      const removeDriverFn = httpsCallable(functions, 'removeDriver');
      await removeDriverFn({ businessId: activeBusinessId, uid: driverId, deleteAuthUser: false });
      alert('تم حذف السائق بنجاح.');
    } catch (error) {
      alert('حدث خطأ أثناء حذف السائق.');
      console.error('Error deleting driver:', error);
    } finally {
      setDeletingDriver(null); // Clear loading state
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  // Helper to format date in en-IL - handles Firestore timestamps
  const formatDate = (dateInput) => {
    if (!dateInput) return '';
    
    let dateObj;
    
    // Handle Firestore timestamp objects
    if (dateInput && typeof dateInput === 'object') {
      if (dateInput.seconds && dateInput.nanoseconds !== undefined) {
        // Firestore timestamp
        dateObj = new Date(dateInput.seconds * 1000);
      } else if (dateInput.toDate && typeof dateInput.toDate === 'function') {
        // Firestore Timestamp object
        dateObj = dateInput.toDate();
      } else {
        // Other object, try to convert
        dateObj = new Date(dateInput);
      }
    } else {
      // String or number
      dateObj = new Date(dateInput);
    }
    
    if (!isNaN(dateObj) && dateObj instanceof Date) {
      return dateObj.toLocaleDateString('en-IL', { year: 'numeric', month: '2-digit', day: '2-digit' });
    }
    
    return '';
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
              placeholder="رقم الهاتف (اختياري)"
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
              background: loading ? '#6c757d' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 16,
              fontWeight: 600,
              opacity: loading ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8
            }}
          >
            {loading && <div style={{ 
              width: 16, 
              height: 16, 
              border: '2px solid transparent', 
              borderTop: '2px solid white', 
              borderRadius: '50%', 
              animation: 'spin 1s linear infinite' 
            }}></div>}
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
                    disabled={deletingDriver === driver.id}
                    style={{
                      background: deletingDriver === driver.id ? '#6c757d' : '#dc3545',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '6px 10px',
                      cursor: deletingDriver === driver.id ? 'not-allowed' : 'pointer',
                      fontSize: 16,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      opacity: deletingDriver === driver.id ? 0.7 : 1
                    }}
                    title={deletingDriver === driver.id ? 'جاري الحذف...' : 'حذف السائق'}
                  >
                    <FiTrash2 /> {deletingDriver === driver.id ? 'جاري الحذف...' : 'حذف'}
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