import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../../firebase/firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import brandConfig from '../../constants/brandConfig';

// Luqma domain or localhost → always require 'luqma' (this repo is the Luqma admin dashboard).
const getRequiredBusinessId = () => {
  if (typeof window !== 'undefined') {
    const h = window.location.hostname;
    if (h.includes('luqma') || h === 'localhost' || h === '127.0.0.1') return 'luqma';
  }
  return brandConfig.id;
};

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  
  // Multi-tenancy state
  const [businessIds, setBusinessIds] = useState([]);
  const [roles, setRoles] = useState([]);
  const [activeBusinessId, setActiveBusinessId] = useState(getRequiredBusinessId());
  const [claims, setClaims] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthError(null);
      console.log('🔐 Auth state changed:', firebaseUser?.email || 'No user');
      
      if (firebaseUser) {
        setUser(firebaseUser);
        
        try {
          // ========================================
          // 1. GET CUSTOM CLAIMS (Multi-Tenancy)
          // ========================================
          const idTokenResult = await firebaseUser.getIdTokenResult(true);
          const userClaims = idTokenResult.claims;
          setClaims(userClaims);
          
          console.log('📋 Custom claims:', userClaims);
          
          const userBusinessIds = userClaims.businessIds || [];
          const userRoles = userClaims.roles || [];
          
          setBusinessIds(userBusinessIds);
          setRoles(userRoles);
          
          // ========================================
          // 2. VALIDATE BUSINESS ACCESS
          // ========================================
          if (userBusinessIds.length === 0) {
            setUserRole('invalid');
            setAuthError('⚠️ لا يوجد لديك صلاحية للوصول إلى أي عمل. يرجى التواصل مع الإدارة.');
            console.warn('❌ User has no business access');
            setLoading(false);
            return;
          }
          
          // ========================================
          // 3. VALIDATE BUSINESS ACCESS FOR CURRENT APP
          // ========================================
          // Required business: Luqma domain → luqma; else from brandConfig (env)
          const requiredBusinessId = getRequiredBusinessId();
          if (!userBusinessIds.includes(requiredBusinessId)) {
            setUserRole('invalid');
            setAuthError(`⚠️ لا يوجد لديك صلاحية للوصول إلى ${requiredBusinessId}. حسابك مُفعل للوصول إلى: ${userBusinessIds.join(', ')}. يرجى تسجيل الخروج وتسجيل الدخول بالحساب المناسب.`);
            console.warn(`❌ User doesn't have access to ${requiredBusinessId}, has access to: ${userBusinessIds.join(', ')}`);
            setLoading(false);
            return;
          }
          
          // User has access to the configured business
          setActiveBusinessId(requiredBusinessId);
          console.log(`✅ User has access to configured business: ${requiredBusinessId}`);
          
          // ========================================
          // 4. SET USER ROLE
          // ========================================
          if (userRoles.includes('admin')) {
            setUserRole('admin');
          } else if (userRoles.includes('driver')) {
            setUserRole('driver');
          } else {
            setUserRole('invalid');
            setAuthError('⚠️ لا يوجد دور صالح. يرجى التواصل مع الإدارة.');
            console.warn('❌ User has no valid role');
          }
          
          // ========================================
          // 5. FETCH USER MEMBERSHIP DOC (Optional - for additional data)
          // ========================================
          try {
            const membershipDoc = await getDoc(
              doc(db, 'menus', requiredBusinessId, 'users', firebaseUser.uid)
            );
            
            if (membershipDoc.exists()) {
              console.log('📄 Membership data:', membershipDoc.data());
            } else {
              console.warn('⚠️ No membership document found');
            }
          } catch (error) {
            console.error('❌ Error fetching membership doc:', error);
            // Non-fatal - continue with claims-based auth
          }
          
          console.log('✅ Auth initialization complete:', {
            uid: firebaseUser.uid,
            businessIds: userBusinessIds,
            activeBusinessId: requiredBusinessId,
            roles: userRoles,
            role: userRoles.includes('admin') ? 'admin' : 'driver'
          });
          
        } catch (error) {
          console.error('❌ Error during auth initialization:', error);
          setUserRole('invalid');
          setAuthError('حدث خطأ أثناء جلب بيانات المستخدم. حاول مرة أخرى أو تواصل مع الدعم.');
        }
      } else {
        // User signed out
        setUser(null);
        setUserRole(null);
        setBusinessIds([]);
        setRoles([]);
        setActiveBusinessId(getRequiredBusinessId());
        setClaims(null);
        setAuthError(null);
        console.log('👋 User signed out');
      }
      
      setLoading(false);
    });
    
    return unsubscribe;
  }, []);

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setUserRole(null);
    setBusinessIds([]);
    setRoles([]);
    setActiveBusinessId(brandConfig.id);
    setClaims(null);
    setAuthError(null);
  };
  
  const switchBusiness = (businessId) => {
    if (businessIds.includes(businessId)) {
      setActiveBusinessId(businessId);
      console.log(`🔄 Switched to business: ${businessId}`);
    } else {
      console.error(`❌ User doesn't have access to business: ${businessId}`);
    }
  };

  const value = {
    // Legacy compatibility
    user,
    userRole,
    loading,
    authError,
    isAdmin: userRole === 'admin',
    isDriver: userRole === 'driver',
    logout,
    
    // Multi-tenancy
    businessIds,
    roles,
    activeBusinessId,
    claims,
    switchBusiness,
    hasMultipleBusinesses: businessIds.length > 1,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 