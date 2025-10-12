import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  FiShoppingBag, 
  FiCheckCircle,
  FiClock,
  FiUser
} from 'react-icons/fi';

const DriverBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();

  const menuItems = [
    {
      id: 'orders',
      label: 'الطلبات',
      icon: FiShoppingBag,
      path: '/driver/orders'
    },
    {
      id: 'profile',
      label: 'الملف الشخصي',
      icon: FiUser,
      path: '/driver/profile'
    }
  ];

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
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
        backgroundColor: '#fff',
        borderTop: '1px solid #e5e5e7',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
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
                padding: '8px 16px',
                border: 'none',
                background: 'transparent',
                color: active ? '#007AFF' : '#8E8E93',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                borderRadius: '12px',
                minWidth: '60px',
                height: '60px'
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
        
        {/* Logout Button */}
        <button
          onClick={handleLogout}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 16px',
            border: 'none',
            background: 'transparent',
            color: '#FF3B30',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            borderRadius: '12px',
            minWidth: '60px',
            height: '60px'
          }}
          onMouseOver={(e) => {
            e.target.style.backgroundColor = 'rgba(255, 59, 48, 0.1)';
          }}
          onMouseOut={(e) => {
            e.target.style.backgroundColor = 'transparent';
          }}
        >
          <FiCheckCircle 
            size={24} 
            style={{ 
              marginBottom: '4px',
              strokeWidth: '2'
            }} 
          />
          <span style={{
            fontSize: '11px',
            fontWeight: '400',
            fontFamily: 'system-ui'
          }}>
            خروج
          </span>
        </button>
      </div>
    </>
  );
};

export default DriverBottomNav;
