import React, { useEffect, useState } from 'react';
import { useNavigate, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { useSidebar } from './contexts/SidebarContext';
import BusinessSwitcher from './components/BusinessSwitcher';
import AdminSidebar from './components/AdminSidebar';
import DriverBottomNav from './components/DriverBottomNav';
import MobileBottomNav from './components/MobileBottomNav';
import NotificationSystem from './components/NotificationSystem';
import ProtectedRoute from './components/ProtectedRoute';
import AuthGuard from './components/AuthGuard';
import RoleSelectionModal from './components/RoleSelectionModal';
import LoginPage from '../pages/LoginPage';
import MealsPage from '../pages/MealsPage';
import OrdersPage from '../pages/OrdersPage';
import DriverOrdersPage from '../pages/DriverOrdersPage';
import DriverProfilePage from '../pages/DriverProfilePage';
import SettingsPage from '../pages/SettingsPage';
import AnalyticsPage from '../pages/AnalyticsPage';
import CouponManagementPage from '../pages/CouponManagementPage';
import { FiLogOut, FiRefreshCw } from 'react-icons/fi';
import { auth } from '../firebase/firebaseConfig';
import { signOut } from 'firebase/auth';
import '../src/styles/admin.css'

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userRole, loading, hasMultipleBusinesses } = useAuth();
  const { isCollapsed } = useSidebar();
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);
  const [selectedRole, setSelectedRole] = useState(() => {
    // Check sessionStorage for selected role
    return sessionStorage.getItem('selectedRole');
  });
  const [showRoleModal, setShowRoleModal] = useState(false);

  // Handle window resize for responsive design
  React.useEffect(() => {
    const handleResize = () => {
      const newIsMobile = window.innerWidth < 768;
      console.log('Window resized, isMobile:', newIsMobile, 'width:', window.innerWidth);
      setIsMobile(newIsMobile);
    };
    
    // Initial check
    handleResize();
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!loading) {
      if (user) {
        // Check if role selection is needed
        const storedRole = sessionStorage.getItem('selectedRole');
        const isLoginPage = location.pathname === '/login';
        
        // Show role selection modal if user is authenticated but no role is selected
        if (!storedRole && !isLoginPage) {
          setShowRoleModal(true);
          return;
        }
        
        // Only redirect if not already on a valid page
        const currentPath = location.pathname;
        const validAdminPaths = ['/orders', '/meals', '/settings', '/analytics', '/coupons'];
        const validDriverPaths = ['/driver/orders', '/driver/profile'];
        
        // Handle role-based routing
        if (storedRole === 'employee') {
          // Employee: Only allow /orders
          if (currentPath !== '/orders' && !currentPath.startsWith('/driver')) {
            navigate('/orders');
          }
        } else if (storedRole === 'admin') {
          // Admin: Full access
          if (userRole === 'driver' && !validDriverPaths.includes(currentPath)) {
            navigate('/driver/orders');
          } else if (userRole === 'admin' && !validAdminPaths.includes(currentPath)) {
            navigate('/analytics');
          } else if (!userRole && !validAdminPaths.includes(currentPath)) {
            navigate('/analytics');
          }
        }
      } else {
        // Clear role selection on logout
        sessionStorage.removeItem('selectedRole');
        sessionStorage.removeItem('adminAuthenticated');
        setSelectedRole(null);
        navigate('/login');
      }
    }
  }, [user, userRole, loading, navigate, location.pathname]);

  const handleRoleSelected = (role) => {
    setSelectedRole(role);
    setShowRoleModal(false);
  };

  const handleSwitchRole = () => {
    // Clear role selection and show modal again
    sessionStorage.removeItem('selectedRole');
    sessionStorage.removeItem('adminAuthenticated');
    setSelectedRole(null);
    setShowRoleModal(true);
  };

  if (loading) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        fontSize: '18px',
        color: '#666',
        backgroundColor: '#f8f9fa'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #e5e5e7',
            borderTop: '3px solid #007AFF',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <p style={{ margin: 0, color: '#666' }}>جاري التحميل...</p>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  const isLoginPage = location.pathname === '/login';
  const isDriverRoute = location.pathname.startsWith('/driver');
  
  // Debug logging - moved to avoid hooks order issue
  console.log('App render - isMobile:', isMobile, 'userRole:', userRole, 'pathname:', location.pathname);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: isLoginPage ? '#f8f9fa' : '#ffffff',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Role Selection Modal */}
      {showRoleModal && user && !loading && (
        <RoleSelectionModal onRoleSelected={handleRoleSelected} />
      )}
      {/* Navigation based on role and screen size */}
      {user && !isLoginPage && (
        <>
          {/* Show sidebar for admin role OR if selectedRole is admin/employee (for employees accessing /orders) */}
          {(userRole === 'admin' || selectedRole === 'admin' || selectedRole === 'employee') && (
            <>
              {/* Desktop Sidebar */}
              {!isMobile && <AdminSidebar onSwitchRole={handleSwitchRole} />}
              {/* Mobile Bottom Navigation - Hidden on Orders page */}
              {isMobile && location.pathname !== '/orders' && <MobileBottomNav />}
            </>
          )}
          {userRole === 'driver' && !location.pathname.startsWith('/driver/orders') && <DriverBottomNav />}
        </>
      )}

      {/* Main Content */}
      <div style={{
        marginLeft: user && userRole === 'admin' && !isLoginPage ? '0' : '0',
        marginBottom: user && userRole === 'driver' && !isLoginPage ? '0' : '0',
        minHeight: '100vh'
      }}>
        {/* Header for admin pages - Desktop only */}
        {user && userRole === 'admin' && !isLoginPage && !isMobile && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: isCollapsed ? '64px' : '280px',
            right: 0,
            height: '80px',
            borderBottom: '1px solid #e5e5e7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            zIndex: 100,
            backdropFilter: 'blur(20px)',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}>
            <div>
              <h1 style={{
                margin: 0,
                fontSize: '24px',
                fontWeight: '600',
                color: '#1d1d1f',
                fontFamily: 'system-ui'
              }}>
                {location.pathname === '/orders' && 'إدارة الطلبات'}
                {location.pathname === '/meals' && 'إدارة القائمة'}
                {location.pathname === '/settings' && 'الإعدادات'}
                {location.pathname === '/analytics' && 'التقارير والإحصائيات'}
                {location.pathname === '/coupons' && 'إدارة الكوبونات'}
              </h1>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* Switch Role Button for Admin */}
              <button
                onClick={handleSwitchRole}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px 12px',
                  border: '1px solid #e5e5e7',
                  background: 'transparent',
                  color: '#007AFF',
                  cursor: 'pointer',
                  borderRadius: '8px',
                  transition: 'all 0.2s ease',
                  fontSize: '14px',
                  fontWeight: '500',
                  gap: '6px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(0, 122, 255, 0.1)';
                  e.currentTarget.style.borderColor = '#007AFF';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = '#e5e5e7';
                }}
                title="تغيير الدور | Switch Role"
              >
                <FiRefreshCw size={16} />
                <span>تغيير الدور</span>
              </button>
              {hasMultipleBusinesses && <BusinessSwitcher />}
              <NotificationSystem />
            </div>
          </div>
        )}

        {/* Mobile Header - Admin or Employee */}
        {user && (userRole === 'admin' || selectedRole === 'employee') && !isLoginPage && isMobile && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: '60px',
            borderBottom: '1px solid #e5e5e7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            zIndex: 100,
            backdropFilter: 'blur(20px)',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)'
          }}>
            {/* Switch Role Button (for employees and admins) or Logout Button - Left Side */}
            {(selectedRole === 'employee' || selectedRole === 'admin') ? (
              <button
                onClick={handleSwitchRole}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px',
                  border: 'none',
                  background: 'transparent',
                  color: '#007AFF',
                  cursor: 'pointer',
                  borderRadius: '8px',
                  transition: 'all 0.2s ease',
                  minWidth: '40px',
                  height: '40px'
                }}
                onMouseDown={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 122, 255, 0.1)'}
                onMouseUp={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                title="تغيير الدور | Switch Role"
              >
                <FiRefreshCw size={20} />
              </button>
            ) : (
              <button
                onClick={async () => {
                  if (window.confirm('هل تريد تسجيل الخروج؟')) {
                    try {
                      await signOut(auth);
                      navigate('/login');
                    } catch (error) {
                      console.error('Logout error:', error);
                    }
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '8px',
                  border: 'none',
                  background: 'transparent',
                  color: '#FF3B30',
                  cursor: 'pointer',
                  borderRadius: '8px',
                  transition: 'all 0.2s ease',
                  minWidth: '40px',
                  height: '40px'
                }}
                onMouseDown={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 59, 48, 0.1)'}
                onMouseUp={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <FiLogOut size={20} />
              </button>
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: '600',
                color: '#1d1d1f',
                fontFamily: 'system-ui',
                textAlign: 'right',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {location.pathname === '/orders' && 'الطلبات'}
                {location.pathname === '/meals' && 'إدارة القائمة'}
                {location.pathname === '/settings' && 'الإعدادات'}
                {location.pathname === '/analytics' && 'التقارير والإحصائيات'}
                {location.pathname === '/coupons' && 'إدارة الكوبونات'}
              </h1>
            </div>
            
            <div style={{ marginLeft: '16px' }}>
              <NotificationSystem />
            </div>
          </div>
        )}

        {/* Content with proper spacing */}
        <div style={{
          paddingTop: !isLoginPage && user && userRole === 'admin' && !isMobile ? '80px' : '0',
          paddingLeft: isLoginPage ? '0' : (user && userRole === 'admin' && !isLoginPage && !isMobile ? (isCollapsed ? '64px' : '280px') : '0'),
          paddingRight: '0',
          paddingBottom: (user && userRole === 'driver' && !isLoginPage) || 
                        (user && userRole === 'admin' && !isLoginPage && isMobile && location.pathname !== '/orders') ? '80px' : '0',
          transition: 'padding-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          minHeight: '100vh'
        }}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            
            {/* Redirect /dashboard to /analytics */}
            <Route path="/dashboard" element={
              <AuthGuard>
                <ProtectedRoute>
                  <Navigate to="/analytics" replace />
                </ProtectedRoute>
              </AuthGuard>
            } />
            
            <Route path="/orders" element={
              <AuthGuard>
                <ProtectedRoute>
                  <OrdersPage />
                </ProtectedRoute>
              </AuthGuard>
            } />
            
            <Route path="/meals" element={
              <AuthGuard>
                <ProtectedRoute>
                  <MealsPage />
                </ProtectedRoute>
              </AuthGuard>
            } />
            
            <Route path="/settings" element={
              <AuthGuard>
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              </AuthGuard>
            } />
            
            <Route path="/analytics" element={
              <AuthGuard>
                <ProtectedRoute>
                  <AnalyticsPage />
                </ProtectedRoute>
              </AuthGuard>
            } />
            
            <Route path="/coupons" element={
              <AuthGuard>
                <ProtectedRoute>
                  <CouponManagementPage />
                </ProtectedRoute>
              </AuthGuard>
            } />
            
            <Route path="/driver/orders" element={
              <AuthGuard>
                <ProtectedRoute>
                  <DriverOrdersPage />
                </ProtectedRoute>
              </AuthGuard>
            } />
            
            <Route path="/driver/profile" element={
              <AuthGuard>
                <ProtectedRoute>
                  <DriverProfilePage />
                </ProtectedRoute>
              </AuthGuard>
            } />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default App;
