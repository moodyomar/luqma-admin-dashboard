import React, { useEffect } from 'react';
import { useNavigate, Routes, Route, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import BusinessSwitcher from './components/BusinessSwitcher';
import AdminSidebar from './components/AdminSidebar';
import DriverBottomNav from './components/DriverBottomNav';
import MobileBottomNav from './components/MobileBottomNav';
import NotificationSystem from './components/NotificationSystem';
import ProtectedRoute from './components/ProtectedRoute';
import AuthGuard from './components/AuthGuard';
import LoginPage from '../pages/LoginPage';
import MealsPage from '../pages/MealsPage';
import OrdersPage from '../pages/OrdersPage';
import DriverOrdersPage from '../pages/DriverOrdersPage';
import UserManagementPage from '../pages/UserManagementPage';
import BusinessManagePage from '../pages/BusinessManagePage';
import AnalyticsPage from '../pages/AnalyticsPage';
import CouponManagementPage from '../pages/CouponManagementPage';
import DashboardPage from '../pages/DashboardPage';
import '../src/styles/admin.css'

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, userRole, loading, hasMultipleBusinesses } = useAuth();
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);

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
        // Only redirect if not already on a valid page
        const currentPath = location.pathname;
        const validAdminPaths = ['/dashboard', '/orders', '/meals', '/users', '/manage', '/analytics', '/coupons'];
        const validDriverPaths = ['/driver/orders', '/driver/profile'];
        
        if (userRole === 'driver' && !validDriverPaths.includes(currentPath)) {
          navigate('/driver/orders');
        } else if (userRole === 'admin' && !validAdminPaths.includes(currentPath)) {
          navigate('/dashboard');
        } else if (!userRole && !validAdminPaths.includes(currentPath)) {
          navigate('/dashboard');
        }
      } else {
        navigate('/login');
      }
    }
  }, [user, userRole, loading, navigate, location.pathname]);

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
      {/* Navigation based on role and screen size */}
      {user && !isLoginPage && (
        <>
          {userRole === 'admin' && (
            <>
              {/* Desktop Sidebar */}
              {!isMobile && <AdminSidebar />}
              {/* Mobile Bottom Navigation - Hidden on Orders page */}
              {isMobile && location.pathname !== '/orders' && <MobileBottomNav />}
            </>
          )}
          {userRole === 'driver' && <DriverBottomNav />}
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
            left: '280px',
            right: 0,
            height: '80px',
            backgroundColor: '#fff',
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
                {location.pathname === '/dashboard' && 'لوحة التحكم'}
                {location.pathname === '/orders' && 'إدارة الطلبات'}
                {location.pathname === '/meals' && 'إدارة القائمة'}
                {location.pathname === '/users' && 'إدارة المستخدمين'}
                {location.pathname === '/manage' && 'إعدادات العمل'}
                {location.pathname === '/analytics' && 'التقارير والإحصائيات'}
                {location.pathname === '/coupons' && 'إدارة الكوبونات'}
              </h1>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {hasMultipleBusinesses && <BusinessSwitcher />}
              <NotificationSystem />
            </div>
          </div>
        )}

        {/* Mobile Header */}
        {user && userRole === 'admin' && !isLoginPage && isMobile && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: '60px',
            backgroundColor: '#fff',
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
                {location.pathname === '/dashboard' && 'لوحة التحكم'}
                {location.pathname === '/orders' && 'الطلبات'}
                {location.pathname === '/meals' && 'إدارة القائمة'}
                {location.pathname === '/users' && 'إدارة المستخدمين'}
                {location.pathname === '/manage' && 'إعدادات العمل'}
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
          paddingTop: '0',
          paddingLeft: isLoginPage ? '0' : (user && userRole === 'admin' && !isLoginPage && !isMobile ? '280px' : '0'),
          paddingRight: '0',
          paddingBottom: (user && userRole === 'driver' && !isLoginPage) || 
                        (user && userRole === 'admin' && !isLoginPage && isMobile && location.pathname !== '/orders') ? '80px' : '0',
          transition: 'padding-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          minHeight: '100vh'
        }}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            
            <Route path="/dashboard" element={
              <AuthGuard>
                <ProtectedRoute>
                  <DashboardPage />
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
            
            <Route path="/users" element={
              <AuthGuard>
                <ProtectedRoute>
                  <UserManagementPage />
                </ProtectedRoute>
              </AuthGuard>
            } />
            
            <Route path="/manage" element={
              <AuthGuard>
                <ProtectedRoute>
                  <BusinessManagePage />
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
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default App;
