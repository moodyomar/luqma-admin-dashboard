import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  FiHome, 
  FiShoppingBag, 
  FiPackage, 
  FiUsers, 
  FiSettings,
  FiBarChart2
} from 'react-icons/fi';

const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userRole } = useAuth();

  const menuItems = [
    {
      id: 'dashboard',
      label: 'الرئيسية',
      icon: FiHome,
      path: '/dashboard'
    },
    {
      id: 'orders',
      label: 'الطلبات',
      icon: FiShoppingBag,
      path: '/orders'
    },
    {
      id: 'meals',
      label: 'القائمة',
      icon: FiPackage,
      path: '/meals',
      adminOnly: true
    },
    {
      id: 'analytics',
      label: 'التقارير',
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
    }
  ];

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // Filter menu items based on user role
  const visibleMenuItems = menuItems.filter(item => 
    !item.adminOnly || userRole === 'admin'
  );

  return (
    <>
      {/* Main Content Spacer */}
      <div style={{ height: '80px' }} />
      
      {/* Bottom Navigation */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '80px',
        borderTop: '1px solid #e5e5e7',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '8px 0',
        zIndex: 9999, // Higher z-index to ensure it stays above all content
        backdropFilter: 'blur(20px)',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        boxShadow: '0 -2px 20px rgba(0, 0, 0, 0.1)'
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
                console.log('Mobile nav clicking:', item.path);
                navigate(item.path);
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 12px',
                border: 'none',
                background: 'transparent',
                color: active ? '#007AFF' : '#8E8E93',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                borderRadius: '12px',
                minWidth: '50px',
                height: '60px',
                pointerEvents: 'auto',
                zIndex: 10000 // Even higher z-index for buttons
              }}
            >
              <Icon 
                size={22} 
                style={{ 
                  marginBottom: '4px',
                  strokeWidth: active ? '2.5' : '2'
                }} 
              />
              <span style={{
                fontSize: '10px',
                fontWeight: active ? '600' : '400',
                fontFamily: 'system-ui',
                textAlign: 'center',
                lineHeight: '1.2'
              }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
};

export default MobileBottomNav;
