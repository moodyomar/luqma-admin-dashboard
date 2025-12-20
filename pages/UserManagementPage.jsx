import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase/firebaseConfig';
import { deleteUser as firebaseDeleteUser } from 'firebase/auth';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { firebaseApp } from '../firebase/firebaseConfig';
import { doc, setDoc, collection, getDocs, deleteDoc, onSnapshot, getDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../src/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import './styles.css';
import { FiLogOut, FiUser, FiMail, FiTrash2, FiPhone, FiEdit2 } from 'react-icons/fi';

const UserManagementPage = () => {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deletingDriver, setDeletingDriver] = useState(null); // Track which driver is being deleted
  const [updatingDriver, setUpdatingDriver] = useState(null); // Track which driver is being updated
  const [editingDriver, setEditingDriver] = useState(null); // Track which driver is being edited
  const [deliveryCities, setDeliveryCities] = useState([]); // Available delivery cities from config
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    phone: ''
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    phone: '',
    password: '',
    allowedDeliveryCities: []
  });
  const { userRole, activeBusinessId } = useAuth();
  const navigate = useNavigate();

  // Load delivery cities from business config
  useEffect(() => {
    const loadDeliveryCities = async () => {
      if (!activeBusinessId) return;
      try {
        const businessRef = doc(db, 'menus', activeBusinessId);
        const businessSnap = await getDoc(businessRef);
        if (businessSnap.exists()) {
          const data = businessSnap.data();
          const cities = data.config?.deliveryCities || [];
          setDeliveryCities(cities);
        }
      } catch (error) {
        console.error('Error loading delivery cities:', error);
      }
    };
    loadDeliveryCities();
  }, [activeBusinessId]);

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

      // Ensure we send the name if it exists, otherwise undefined (not empty string)
      const trimmedName = formData.name?.trim();
      const displayNameValue = trimmedName && trimmedName.length > 0 ? trimmedName : undefined;
      console.log('📤 [CreateDriver] Sending inviteUser request:', {
        email: formData.email.trim(),
        displayName: displayNameValue,
        phone: formattedPhone,
        hasName: !!trimmedName,
        nameLength: trimmedName?.length || 0,
        rawFormDataName: formData.name
      });
      
      const result = await inviteUser({
        businessId: activeBusinessId,
        email: formData.email.trim(),
        password: formData.password, // Send the password
        role: 'driver',
        displayName: displayNameValue, // Always send name, even if empty
        phone: formattedPhone, // Send formatted phone or undefined
      });
      
      console.log('📥 [CreateDriver] inviteUser response:', result.data);

      const { uid } = result.data || {};

      // Note: The cloud function already creates/updates the membership document with all data
      // including name, email, phone, etc. No need to duplicate here.
      // The real-time listener will automatically update the UI.
      
      // If name was provided but result shows it wasn't saved, log a warning
      if (formData.name?.trim() && uid) {
        console.log(`✅ Driver created/updated with name: ${formData.name.trim()}`);
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

  // Open edit modal for driver
  const handleEditDriver = async (driver) => {
    // Fetch latest driver data from Firestore to ensure we have the most up-to-date allowedDeliveryCities
    try {
      const driverRef = doc(db, 'menus', activeBusinessId, 'users', driver.id);
      const driverSnap = await getDoc(driverRef);
      
      if (driverSnap.exists()) {
        const latestDriverData = driverSnap.data();
        console.log('📋 Loading driver data for edit:', {
          driverId: driver.id,
          allowedDeliveryCities: latestDriverData.allowedDeliveryCities,
          citiesCount: latestDriverData.allowedDeliveryCities?.length || 0
        });
        
        setEditFormData({
          name: latestDriverData.name || driver.name || '',
          phone: latestDriverData.phone || driver.phone || '',
          allowedDeliveryCities: latestDriverData.allowedDeliveryCities || []
        });
        setEditingDriver({ ...driver, ...latestDriverData });
      } else {
        // Fallback to driver data from state if document doesn't exist
        setEditFormData({
          name: driver.name || '',
          phone: driver.phone || '',
          allowedDeliveryCities: driver.allowedDeliveryCities || []
        });
        setEditingDriver(driver);
      }
    } catch (error) {
      console.error('Error fetching driver data for edit:', error);
      // Fallback to driver data from state on error
      setEditFormData({
        name: driver.name || '',
        phone: driver.phone || '',
        allowedDeliveryCities: driver.allowedDeliveryCities || []
      });
      setEditingDriver(driver);
    }
  };

  // Close edit modal
  const handleCloseEdit = () => {
    setEditingDriver(null);
    setEditFormData({
      name: '',
      phone: '',
      password: '',
      allowedDeliveryCities: []
    });
  };

  // Save driver edits
  const handleSaveDriverEdit = async () => {
    if (!editingDriver || !activeBusinessId) return;
    
    setUpdatingDriver(editingDriver.id);
    try {
      const functions = getFunctions(firebaseApp, import.meta.env.VITE_FIREBASE_REGION || 'us-central1');
      if (import.meta.env.DEV && import.meta.env.VITE_USE_FUNCTIONS_EMULATOR === 'true') {
        connectFunctionsEmulator(functions, 'localhost', 5001);
      }
      const inviteUser = httpsCallable(functions, 'inviteUser');
      
      // Format phone number
      let formattedPhone = undefined;
      if (editFormData.phone?.trim()) {
        const phone = editFormData.phone.trim();
        if (phone.startsWith('0')) {
          formattedPhone = '+972' + phone.substring(1);
        } else if (!phone.startsWith('+')) {
          formattedPhone = '+972' + phone;
        } else {
          formattedPhone = phone;
        }
      }
      
      // Update name, phone, and allowed delivery cities via inviteUser function
      console.log('💾 Saving driver data:', {
        driverId: editingDriver.id,
        allowedDeliveryCities: editFormData.allowedDeliveryCities,
        citiesCount: editFormData.allowedDeliveryCities.length
      });
      
      const inviteUserData = {
        businessId: activeBusinessId,
        email: editingDriver.email,
        role: 'driver',
        displayName: editFormData.name.trim() || undefined,
        phone: formattedPhone,
        allowedDeliveryCities: editFormData.allowedDeliveryCities,
      };
      
      // Only include password if it was provided (not empty, at least 6 characters)
      if (editFormData.password && editFormData.password.trim().length >= 6) {
        inviteUserData.password = editFormData.password.trim();
      }
      
      console.log('📤 Sending to inviteUser function:', {
        ...inviteUserData,
        hasPassword: !!inviteUserData.password,
        allowedDeliveryCitiesType: typeof inviteUserData.allowedDeliveryCities,
        allowedDeliveryCitiesIsArray: Array.isArray(inviteUserData.allowedDeliveryCities),
        allowedDeliveryCitiesLength: Array.isArray(inviteUserData.allowedDeliveryCities) ? inviteUserData.allowedDeliveryCities.length : 'not an array'
      });
      
      const result = await inviteUser(inviteUserData);
      
      console.log('📥 Response from inviteUser:', result.data);
      
      console.log('✅ Driver data saved successfully');
      
      // Wait a moment for Firestore to update, then refresh the driver data
      setTimeout(() => {
        // The real-time listener should update automatically, but we can force a refresh
        const driverRef = doc(db, 'menus', activeBusinessId, 'users', editingDriver.id);
        getDoc(driverRef).then((snap) => {
          if (snap.exists()) {
            const savedData = snap.data();
            console.log('✅ Verified saved data:', {
              allowedDeliveryCities: savedData.allowedDeliveryCities,
              citiesCount: savedData.allowedDeliveryCities?.length || 0
            });
          }
        });
      }, 500);
      
      alert('✅ تم تحديث بيانات السائق بنجاح!');
      handleCloseEdit();
    } catch (error) {
      alert('حدث خطأ أثناء تحديث بيانات السائق.');
      console.error('Error updating driver:', error);
    } finally {
      setUpdatingDriver(null);
    }
  };

  // Toggle city for driver in edit form
  const toggleCityInEdit = (cityObj) => {
    const currentCities = editFormData.allowedDeliveryCities || [];
    const cityHe = typeof cityObj === 'string' ? cityObj : cityObj.he;
    const cityAr = typeof cityObj === 'string' ? '' : cityObj.ar;
    
    // Check if city is already in allowed list
    const cityExists = currentCities.some(c => {
      const cHe = typeof c === 'string' ? c : c.he;
      const cAr = typeof c === 'string' ? '' : c.ar;
      return (
        (cHe && cityHe && cHe.toLowerCase() === cityHe.toLowerCase()) ||
        (cAr && cityAr && cAr.toLowerCase() === cityAr.toLowerCase())
      );
    });
    
    if (cityExists) {
      // Remove city
      setEditFormData(prev => ({
        ...prev,
        allowedDeliveryCities: currentCities.filter(c => {
          const cHe = typeof c === 'string' ? c : c.he;
          const cAr = typeof c === 'string' ? '' : c.ar;
          return !(
            (cHe && cityHe && cHe.toLowerCase() === cityHe.toLowerCase()) ||
            (cAr && cityAr && cAr.toLowerCase() === cityAr.toLowerCase())
          );
        })
      }));
    } else {
      // Add city
      setEditFormData(prev => ({
        ...prev,
        allowedDeliveryCities: [...currentCities, typeof cityObj === 'string' ? { he: cityObj, ar: '' } : cityObj]
      }));
    }
  };

  // Update driver name (for drivers created before the fix) - kept for backward compatibility
  const handleUpdateDriverName = async (driver) => {
    const newName = window.prompt(`أدخل اسم السائق لـ ${driver.email}:`, driver.name || '');
    if (!newName || !newName.trim()) return;
    
    setUpdatingDriver(driver.id);
    try {
      const functions = getFunctions(firebaseApp, import.meta.env.VITE_FIREBASE_REGION || 'us-central1');
      if (import.meta.env.DEV && import.meta.env.VITE_USE_FUNCTIONS_EMULATOR === 'true') {
        connectFunctionsEmulator(functions, 'localhost', 5001);
      }
      const inviteUser = httpsCallable(functions, 'inviteUser');
      
      console.log('📤 [UpdateDriverName] Sending inviteUser request to update name:', {
        email: driver.email,
        displayName: newName.trim(),
        driverId: driver.id
      });
      
      // Re-invite with name to update existing driver
      const result = await inviteUser({
        businessId: activeBusinessId,
        email: driver.email,
        role: 'driver',
        displayName: newName.trim(),
        phone: driver.phone || undefined,
      });
      
      console.log('📥 [UpdateDriverName] inviteUser response:', result.data);
      
      alert('✅ تم تحديث اسم السائق بنجاح!');
    } catch (error) {
      alert('حدث خطأ أثناء تحديث اسم السائق.');
      console.error('Error updating driver name:', error);
    } finally {
      setUpdatingDriver(null);
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
      // Delete from both Firestore and Firebase Authentication for complete removal
      await removeDriverFn({ businessId: activeBusinessId, uid: driverId, deleteAuthUser: true });
      alert('✅ تم حذف السائق بنجاح من النظام بالكامل.');
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
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handleEditDriver(driver)}
                      disabled={updatingDriver === driver.id || deletingDriver === driver.id}
                      style={{
                        background: '#007bff',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '6px 10px',
                        cursor: (updatingDriver === driver.id || deletingDriver === driver.id) ? 'not-allowed' : 'pointer',
                        fontSize: 14,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        opacity: (updatingDriver === driver.id || deletingDriver === driver.id) ? 0.7 : 1,
                        fontWeight: 600
                      }}
                      title="تعديل السائق"
                    >
                      <FiEdit2 /> تعديل
                    </button>
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

      {/* Edit Driver Modal */}
      {editingDriver && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: isMobile ? '10px' : '20px'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 12,
            width: '100%',
            maxWidth: isMobile ? '95%' : 600,
            maxHeight: isMobile ? '85vh' : '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
            overflow: 'hidden'
          }}>
            {/* Header - Fixed */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: isMobile ? '16px' : '24px',
              paddingBottom: isMobile ? 12 : 16,
              borderBottom: '1px solid #dee2e6',
              flexShrink: 0
            }}>
              <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 20, fontWeight: 700, color: '#495057' }}>
                تعديل بيانات السائق
              </h2>
              <button
                onClick={handleCloseEdit}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 24,
                  cursor: 'pointer',
                  color: '#6c757d',
                  padding: 0,
                  width: 30,
                  height: 30,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ×
              </button>
            </div>

            {/* Scrollable Content */}
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 16,
              overflowY: 'auto',
              overflowX: 'hidden',
              flex: '1 1 0',
              padding: isMobile ? '16px' : '24px',
              paddingTop: isMobile ? 16 : 20,
              minHeight: 0,
              WebkitOverflowScrolling: 'touch'
            }}>
              {/* Email (read-only) */}
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14, color: '#495057' }}>
                  البريد الإلكتروني
                </label>
                <input
                  type="email"
                  value={editingDriver.email}
                  disabled
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: 6,
                    border: '1px solid #ced4da',
                    background: '#f8f9fa',
                    color: '#6c757d',
                    fontSize: 14
                  }}
                />
              </div>

              {/* Name */}
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14, color: '#495057' }}>
                  اسم السائق *
                </label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="اسم السائق"
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: 6,
                    border: '1px solid #ced4da',
                    fontSize: 14
                  }}
                />
              </div>

              {/* Phone */}
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14, color: '#495057' }}>
                  رقم الهاتف
                </label>
                <input
                  type="tel"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="رقم الهاتف (اختياري)"
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: 6,
                    border: '1px solid #ced4da',
                    fontSize: 14
                  }}
                />
              </div>

              {/* Password */}
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14, color: '#495057' }}>
                  كلمة المرور
                </label>
                <input
                  type="password"
                  value={editFormData.password}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="اتركه فارغاً للحفاظ على كلمة المرور الحالية (أدخل كلمة جديدة لتغييرها)"
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: 6,
                    border: '1px solid #ced4da',
                    fontSize: 14
                  }}
                />
                <div style={{ fontSize: 11, color: '#6c757d', marginTop: 4 }}>
                  اتركه فارغاً للحفاظ على كلمة المرور الحالية. أدخل كلمة جديدة (6 أحرف على الأقل) لتغييرها.
                </div>
              </div>

              {/* Allowed Delivery Cities */}
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 600, fontSize: 14, color: '#495057' }}>
                  المدن المسموح بالتوصيل إليها
                </label>
                <div style={{ fontSize: 12, color: '#6c757d', marginBottom: 8 }}>
                  اختر المدن التي يمكن لهذا السائق تلقي طلبات التوصيل إليها. إذا لم يتم تحديد أي مدينة، سيتلقى السائق جميع الطلبات (للتوافق مع الإصدارات السابقة).
                </div>
                
                {deliveryCities.length === 0 ? (
                  <div style={{
                    padding: 16,
                    background: '#fff3cd',
                    border: '1px solid #ffc107',
                    borderRadius: 6,
                    fontSize: 13,
                    color: '#856404',
                    textAlign: 'center'
                  }}>
                    ⚠️ لا توجد مدن مضافة. يرجى إضافة المدن في صفحة الإعدادات أولاً.
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
                    gap: 10,
                    maxHeight: 200,
                    overflowY: 'auto',
                    padding: 12,
                    background: '#f8f9fa',
                    borderRadius: 6,
                    border: '1px solid #dee2e6'
                  }}>
                    {deliveryCities.map((cityObj, idx) => {
                      const cityHe = typeof cityObj === 'string' ? cityObj : cityObj.he;
                      const cityAr = typeof cityObj === 'string' ? '' : cityObj.ar;
                      
                      const isAllowed = editFormData.allowedDeliveryCities.some(c => {
                        const cHe = typeof c === 'string' ? c : c.he;
                        const cAr = typeof c === 'string' ? '' : c.ar;
                        return (
                          (cHe && cityHe && cHe.toLowerCase() === cityHe.toLowerCase()) ||
                          (cAr && cityAr && cAr.toLowerCase() === cityAr.toLowerCase())
                        );
                      });

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => toggleCityInEdit(cityObj)}
                          style={{
                            background: isAllowed ? '#28a745' : '#e9ecef',
                            color: isAllowed ? '#fff' : '#495057',
                            border: 'none',
                            borderRadius: 6,
                            padding: '6px 8px',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            textAlign: 'center',
                            lineHeight: 1.3,
                            minHeight: 32
                          }}
                        >
                          {cityAr || cityHe}
                        </button>
                      );
                    })}
                  </div>
                )}
                
                <div style={{ fontSize: 11, color: '#6c757d', marginTop: 8 }}>
                  {editFormData.allowedDeliveryCities.length > 0 
                    ? `تم اختيار ${editFormData.allowedDeliveryCities.length} مدينة` 
                    : 'لم يتم اختيار أي مدينة - السائق سيتلقى جميع الطلبات'}
                </div>
              </div>
            </div>

            {/* Action Buttons - Fixed at bottom */}
            <div style={{ 
              display: 'flex', 
              gap: 10, 
              padding: isMobile ? '12px 16px' : '16px 24px',
              borderTop: '1px solid #dee2e6',
              background: '#fff',
              flexShrink: 0,
              marginTop: 'auto'
            }}>
              <button
                onClick={handleSaveDriverEdit}
                disabled={updatingDriver === editingDriver.id || !editFormData.name.trim()}
                style={{
                  flex: 1,
                  padding: isMobile ? '10px 16px' : '12px 24px',
                  background: (updatingDriver === editingDriver.id || !editFormData.name.trim()) ? '#6c757d' : '#28a745',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: (updatingDriver === editingDriver.id || !editFormData.name.trim()) ? 'not-allowed' : 'pointer',
                  fontSize: isMobile ? 14 : 16,
                  fontWeight: 600,
                  opacity: (updatingDriver === editingDriver.id || !editFormData.name.trim()) ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8
                }}
              >
                {updatingDriver === editingDriver.id && <div style={{ 
                  width: 16, 
                  height: 16, 
                  border: '2px solid transparent', 
                  borderTop: '2px solid white', 
                  borderRadius: '50%', 
                  animation: 'spin 1s linear infinite' 
                }}></div>}
                {updatingDriver === editingDriver.id ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </button>
              <button
                onClick={handleCloseEdit}
                disabled={updatingDriver === editingDriver.id}
                style={{
                  flex: 1,
                  padding: isMobile ? '10px 16px' : '12px 24px',
                  background: '#6c757d',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: updatingDriver === editingDriver.id ? 'not-allowed' : 'pointer',
                  fontSize: isMobile ? 14 : 16,
                  fontWeight: 600,
                  opacity: updatingDriver === editingDriver.id ? 0.7 : 1
                }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementPage; 