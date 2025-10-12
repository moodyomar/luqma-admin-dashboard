import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  FiHome, 
  FiPackage, 
  FiShoppingBag, 
  FiUsers, 
  FiSettings,
  FiBarChart2,
  FiLogOut,
  FiMenu,
  FiX
} from 'react-icons/fi';

const AdminSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user, userRole } = useAuth();
  const [isCollapsed, setIsCollapsed] = React.useState(window.innerWidth < 768);

  // Handle window resize
  React.useEffect(() => {
    const handleResize = () => {
      setIsCollapsed(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-collapse on mobile on mount
  React.useEffect(() => {
    if (window.innerWidth < 768) {
      setIsCollapsed(true);
    }
  }, []);

  const menuItems = [
    {
      id: 'dashboard',
      label: 'لوحة التحكم',
      icon: FiHome,
      path: '/dashboard',
      adminOnly: false
    },
    {
      id: 'orders',
      label: 'الطلبات',
      icon: FiShoppingBag,
      path: '/orders',
      adminOnly: false
    },
    {
      id: 'meals',
      label: 'إدارة القائمة',
      icon: FiPackage,
      path: '/meals',
      adminOnly: true
    },
    {
      id: 'analytics',
      label: 'التقارير والإحصائيات',
      icon: FiBarChart2,
      path: '/analytics',
      adminOnly: true
    },
    {
      id: 'users',
      label: 'إدارة المستخدمين',
      icon: FiUsers,
      path: '/users',
      adminOnly: true
    },
    {
      id: 'settings',
      label: 'الإعدادات',
      icon: FiSettings,
      path: '/manage',
      adminOnly: true
    }
  ];

  // Filter menu items based on user role
  const visibleMenuItems = menuItems.filter(item => 
    !item.adminOnly || userRole === 'admin'
  );

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile Overlay */}
      {!isCollapsed && window.innerWidth < 768 && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 999,
            display: 'block',
            pointerEvents: 'auto'
          }}
          onClick={() => setIsCollapsed(true)}
        />
      )}

      {/* Sidebar */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        height: '100vh',
        width: isCollapsed ? '80px' : '280px',
        backgroundColor: '#1a1a1a',
        color: 'white',
        zIndex: 1000,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '4px 0 20px rgba(0, 0, 0, 0.1)',
        borderRight: '1px solid #333',
        pointerEvents: 'auto'
      }}>
        
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #333',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: '80px'
        }}>
          {!isCollapsed && (
            <div>
              <h2 style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: '600',
                color: '#fff',
                marginBottom: '4px'
              }}>
                لوحة التحكم
              </h2>
              <p style={{
                margin: 0,
                fontSize: '14px',
                color: '#888',
                fontFamily: 'system-ui'
              }}>
                {user?.email || 'Admin'}
              </p>
            </div>
          )}
          
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Toggle sidebar clicked');
              setIsCollapsed(!isCollapsed);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#888',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              pointerEvents: 'auto',
              zIndex: 1001
            }}
          >
            {isCollapsed ? <FiMenu size={20} /> : <FiX size={20} />}
          </button>
        </div>

        {/* Navigation Menu */}
        <nav style={{
          flex: 1,
          padding: '16px 0',
          overflowY: 'auto'
        }}>
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            
            return (
              <button
                key={item.id}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('Sidebar navigation clicked:', item.path);
                  navigate(item.path);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '16px 24px',
                  border: 'none',
                  background: active ? '#007AFF' : 'transparent',
                  color: active ? '#fff' : '#ccc',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  textAlign: 'right',
                  fontFamily: 'system-ui',
                  fontSize: '15px',
                  fontWeight: active ? '500' : '400',
                  position: 'relative',
                  pointerEvents: 'auto',
                  zIndex: 1001
                }}
              >
                <Icon 
                  size={20} 
                  style={{ 
                    marginLeft: isCollapsed ? '0' : '12px',
                    marginRight: isCollapsed ? '0' : 'auto',
                    minWidth: '20px'
                  }} 
                />
                {!isCollapsed && (
                  <span style={{ flex: 1, textAlign: 'right' }}>
                    {item.label}
                  </span>
                )}
                
                {/* Active indicator */}
                {active && (
                  <div style={{
                    position: 'absolute',
                    right: '0',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '3px',
                    height: '24px',
                    backgroundColor: '#fff',
                    borderRadius: '2px 0 0 2px'
                  }} />
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #333'
        }}>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              console.log('Logout clicked');
              handleLogout();
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              padding: '12px 16px',
              border: 'none',
              background: 'transparent',
              color: '#ff6b6b',
              cursor: 'pointer',
              borderRadius: '8px',
              transition: 'all 0.2s ease',
              fontFamily: 'system-ui',
              fontSize: '14px',
              fontWeight: '500',
              pointerEvents: 'auto',
              zIndex: 1001
            }}
          >
            <FiLogOut 
              size={18} 
              style={{ 
                marginLeft: isCollapsed ? '0' : '12px',
                marginRight: isCollapsed ? '0' : 'auto',
                minWidth: '18px'
              }} 
            />
            {!isCollapsed && (
              <span style={{ flex: 1, textAlign: 'right' }}>
                تسجيل الخروج
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Spacer - Only on desktop */}
      {window.innerWidth >= 768 && (
        <div style={{
          width: isCollapsed ? '80px' : '280px',
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }} />
      )}
    </>
  );
};

export default AdminSidebar;
