import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../../firebase/firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthError(null);
      console.log('Auth state changed:', firebaseUser);
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          console.log('Fetched userDoc:', userDoc.exists() ? userDoc.data() : 'No doc');
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.role) {
              setUserRole(userData.role);
              setAuthError(null);
              console.log('User role found:', userData.role);
            } else {
              setUserRole('invalid');
              setAuthError('⚠️ لا يوجد دور مخصص لهذا الحساب. يرجى التواصل مع الإدارة.');
              console.warn('User doc missing role field');
            }
          } else {
            setUserRole('invalid');
            setAuthError('⚠️ لا يوجد ملف مستخدم. يرجى التواصل مع الإدارة.');
            console.warn('No user doc found in Firestore');
          }
        } catch (error) {
          console.error('Error fetching user role:', error);
          setUserRole('invalid');
          setAuthError('حدث خطأ أثناء جلب بيانات المستخدم. حاول مرة أخرى أو تواصل مع الدعم.');
        }
      } else {
        setUser(null);
        setUserRole(null);
        setAuthError(null);
        console.log('No user authenticated');
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setUserRole(null);
    setAuthError(null);
  };

  const value = {
    user,
    userRole,
    loading,
    authError,
    isAdmin: userRole === 'admin',
    isDriver: userRole === 'driver',
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 