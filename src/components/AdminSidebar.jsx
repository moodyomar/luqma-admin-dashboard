import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSidebar } from '../contexts/SidebarContext';
import { 
  FiPackage, 
  FiShoppingBag, 
  FiUsers, 
  FiSettings,
  FiBarChart2,
  FiLogOut,
  FiMenu,
  FiX,
  FiRefreshCw,
  FiAlertTriangle
} from 'react-icons/fi';

const AdminSidebar = ({ onSwitchRole }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user, userRole } = useAuth();
  const { isCollapsed, setIsCollapsed } = useSidebar();

  // Handle window resize
  React.useEffect(() => {
    const handleResize = () => {
      // Auto-collapse on mobile, but allow manual toggle on desktop
      if (window.innerWidth < 768) {
        setIsCollapsed(true);
      }
      // On desktop, keep the current state (collapsed or expanded)
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setIsCollapsed]);

  const menuItems = [
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
      id: 'settings',
      label: 'الإعدادات',
      icon: FiSettings,
      path: '/settings',
      adminOnly: true
    },
    // Debug tools - only in development mode
    ...(import.meta.env.DEV ? [{
      id: 'debug',
      label: 'أدوات التطوير',
      icon: FiAlertTriangle,
      path: '/debug',
      adminOnly: true
    }] : [])
  ];

  // Check selected role from sessionStorage (for employee/admin distinction)
  const selectedRole = sessionStorage.getItem('selectedRole');
  const isEmployee = selectedRole === 'employee';
  
  // Filter menu items based on user role and selected role
  // Employees can only see /orders, admins see all items
  const visibleMenuItems = menuItems.filter(item => {
    if (isEmployee) {
      // Employees can only see orders
      return item.path === '/orders';
    }
    // Admins see all items based on their role
    return !item.adminOnly || userRole === 'admin';
  });

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
        width: isCollapsed ? '64px' : '280px',
        backgroundColor: '#1a1a1a',
        color: 'white',
        zIndex: 1000,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '4px 0 20px rgba(0, 0, 0, 0.1)',
        borderRight: '1px solid #333',
        pointerEvents: 'auto',
        overflowX: 'hidden',
        overflowY: 'auto',
        boxSizing: 'border-box'
      }}>
        
        {/* Header */}
        <div style={{
          padding: isCollapsed ? '16px 8px' : '24px',
          borderBottom: '1px solid #333',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          minHeight: isCollapsed ? '64px' : '80px',
          flexShrink: 0,
          overflow: 'hidden',
          boxSizing: 'border-box'
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
              zIndex: 1001,
              marginLeft: isCollapsed ? '0' : 'auto'
            }}
          >
            {isCollapsed ? <FiMenu size={20} /> : <FiX size={20} />}
          </button>
        </div>

        {/* Navigation Menu */}
        <nav style={{
          flex: 1,
          padding: '16px 0',
          overflowY: 'auto',
          overflowX: 'hidden',
          minWidth: 0,
          boxSizing: 'border-box'
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
                  padding: isCollapsed ? '16px 8px' : '16px 24px',
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
                  zIndex: 1001,
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  minWidth: 0,
                  boxSizing: 'border-box',
                  overflow: 'hidden'
                }}
              >
                <Icon 
                  size={20} 
                  style={{ 
                    marginLeft: isCollapsed ? '0' : '12px',
                    marginRight: isCollapsed ? '0' : 'auto',
                    minWidth: '20px',
                    maxWidth: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }} 
                />
                {!isCollapsed && (
                  <span style={{ 
                    flex: 1, 
                    textAlign: 'right',
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
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
          padding: isCollapsed ? '16px 8px' : '16px 24px',
          borderTop: '1px solid #333',
          flexShrink: 0,
          overflow: 'hidden',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          {/* Switch Role Button */}
          {onSwitchRole && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onSwitchRole) {
                  onSwitchRole();
                }
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                padding: isCollapsed ? '12px 8px' : '12px 16px',
                border: 'none',
                background: 'transparent',
                color: '#007AFF',
                cursor: 'pointer',
                borderRadius: '8px',
                transition: 'all 0.2s ease',
                fontFamily: 'system-ui',
                fontSize: '14px',
                fontWeight: '500',
                pointerEvents: 'auto',
                zIndex: 1001,
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                minWidth: 0,
                boxSizing: 'border-box',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 122, 255, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <FiRefreshCw 
                size={18} 
                style={{ 
                  marginLeft: isCollapsed ? '0' : '12px',
                  marginRight: isCollapsed ? '0' : 'auto',
                  minWidth: '18px',
                  maxWidth: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }} 
              />
              {!isCollapsed && (
                <span style={{ 
                  flex: 1, 
                  textAlign: 'right',
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  تغيير الدور | Switch Role
                </span>
              )}
            </button>
          )}
          
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
              padding: isCollapsed ? '12px 8px' : '12px 16px',
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
              zIndex: 1001,
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              minWidth: 0,
              boxSizing: 'border-box',
              overflow: 'hidden'
            }}
          >
            <FiLogOut 
              size={18} 
              style={{ 
                marginLeft: isCollapsed ? '0' : '12px',
                marginRight: isCollapsed ? '0' : 'auto',
                minWidth: '18px',
                maxWidth: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }} 
            />
            {!isCollapsed && (
              <span style={{ 
                flex: 1, 
                textAlign: 'right',
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                تسجيل الخروج
              </span>
            )}
          </button>
        </div>
      </div>

    </>
  );
};

export default AdminSidebar;
