import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ 
  children, 
  allowedRoles = ['admin', 'driver'], 
  redirectTo = '/login' 
}) => {
  const { user, userRole, loading, authError, logout } = useAuth();

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        fontSize: '18px',
        color: '#666'
      }}>
        جاري التحميل... | Loading...
      </div>
    );
  }

  if (authError) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        fontSize: '18px',
        color: '#b71c1c',
        textAlign: 'center',
        padding: 24
      }}>
        <div style={{ marginBottom: 24 }}>
          ⚠️ {authError}
        </div>
        <button
          onClick={logout}
          style={{
            padding: '10px 24px',
            background: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 16
          }}
        >
          تسجيل خروج | Logout
        </button>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={redirectTo} replace />;
  }

  if (!allowedRoles.includes(userRole)) {
    // Redirect based on role
    if (userRole === 'driver') {
      return <Navigate to="/driver/orders" replace />;
    } else if (userRole === 'admin') {
      return <Navigate to="/meals" replace />;
    } else {
      return <Navigate to={redirectTo} replace />;
    }
  }

  return children;
};

export default ProtectedRoute; 