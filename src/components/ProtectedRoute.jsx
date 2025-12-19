import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ 
  children, 
  allowedRoles = ['admin', 'driver'], 
  redirectTo = '/login' 
}) => {
  const { user, userRole, loading, authError, logout } = useAuth();
  const location = useLocation();
  
  // Check sessionStorage for selected role (employee/admin)
  const selectedRole = sessionStorage.getItem('selectedRole');
  
  // Admin-only routes that employees cannot access
  const adminOnlyRoutes = ['/meals', '/settings', '/analytics', '/coupons'];
  const isAdminOnlyRoute = adminOnlyRoutes.includes(location.pathname);

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

  // Restrict employee access: employees can only access /orders
  if (selectedRole === 'employee' && isAdminOnlyRoute) {
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
          ⚠️ ليس لديك صلاحية للوصول إلى هذه الصفحة
        </div>
        <button
          onClick={() => window.location.href = '/orders'}
          style={{
            padding: '10px 24px',
            background: '#007aff',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 16
          }}
        >
          العودة إلى الطلبات | Back to Orders
        </button>
      </div>
    );
  }

  // Check if admin password is required for admin routes
  if (selectedRole === 'admin' && isAdminOnlyRoute) {
    const adminAuthenticated = sessionStorage.getItem('adminAuthenticated');
    if (adminAuthenticated !== 'true') {
      // Clear role and redirect to login to show role selection again
      sessionStorage.removeItem('selectedRole');
      return <Navigate to="/login" replace />;
    }
  }

  if (!allowedRoles.includes(userRole)) {
    // Redirect based on role
    if (userRole === 'driver') {
      return <Navigate to="/driver/orders" replace />;
    } else if (userRole === 'admin') {
      return <Navigate to="/analytics" replace />;
    } else {
      return <Navigate to={redirectTo} replace />;
    }
  }

  return children;
};

export default ProtectedRoute; 