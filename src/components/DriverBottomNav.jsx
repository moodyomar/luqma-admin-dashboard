import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  FiShoppingBag, 
  FiSettings
} from 'react-icons/fi';

const DriverBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const menuItems = [
    {
      id: 'orders',
      label: 'الطلبات',
      icon: FiShoppingBag,
      path: '/driver/orders'
    },
    {
      id: 'settings',
      label: 'الإعدادات',
      icon: FiSettings,
      path: '/driver/profile'
    }
  ];

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

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
        justifyContent: 'center',
        padding: '8px 0',
        zIndex: 1000,
        backdropFilter: 'blur(20px)',
        backgroundColor: 'rgba(255, 255, 255, 0.8)'
      }}>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 24px',
                border: 'none',
                background: 'transparent',
                color: active ? '#007AFF' : '#8E8E93',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                borderRadius: '12px',
                minWidth: '80px',
                height: '60px',
                margin: '0 20px'
              }}
              onMouseOver={(e) => {
                if (!active) {
                  e.target.style.backgroundColor = 'rgba(0, 122, 255, 0.1)';
                }
              }}
              onMouseOut={(e) => {
                if (!active) {
                  e.target.style.backgroundColor = 'transparent';
                }
              }}
            >
              <Icon 
                size={24} 
                style={{ 
                  marginBottom: '4px',
                  strokeWidth: active ? '2.5' : '2'
                }} 
              />
              <span style={{
                fontSize: '11px',
                fontWeight: active ? '600' : '400',
                fontFamily: 'system-ui'
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

export default DriverBottomNav;
