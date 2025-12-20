import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import brandConfig from '../../constants/brandConfig';

const RoleSelectionModal = ({ onRoleSelected, onClose }) => {
  const [selectedRole, setSelectedRole] = useState(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Admin password from brandConfig
  const ADMIN_PASSWORD = brandConfig.adminPassword || 'admin123';

  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    setPasswordError('');
    
    if (role === 'employee') {
      // Employee: Direct access to /orders
      sessionStorage.setItem('selectedRole', 'employee');
      navigate('/orders');
      if (onRoleSelected) onRoleSelected('employee');
    }
    // Admin: Show password input
  };

  const handleAdminSubmit = (e) => {
    e.preventDefault();
    setPasswordError('');
    
    if (!adminPassword) {
      setPasswordError('يرجى إدخال كلمة المرور');
      return;
    }

    setIsLoading(true);
    
    // Simulate password check (in production, this could be more secure)
    setTimeout(() => {
      if (adminPassword === ADMIN_PASSWORD) {
        sessionStorage.setItem('selectedRole', 'admin');
        sessionStorage.setItem('adminAuthenticated', 'true');
        navigate('/dashboard');
        if (onRoleSelected) onRoleSelected('admin');
      } else {
        setPasswordError('كلمة المرور غير صحيحة');
        setIsLoading(false);
      }
    }, 300);
  };

  const handleBack = () => {
    setSelectedRole(null);
    setAdminPassword('');
    setPasswordError('');
  };

  const handleOverlayClick = () => {
    // Only allow closing on initial role selection screen, not during password entry
    if (!selectedRole && onClose) {
      onClose();
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10000,
        backdropFilter: 'blur(4px)'
      }}
      onClick={handleOverlayClick}
    >
      <div 
        style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '32px',
          maxWidth: '400px',
          width: '90%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          animation: 'fadeIn 0.3s ease-out',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: scale(0.95);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}</style>

        {!selectedRole ? (
          // Role Selection
          <>
            <div style={{
              textAlign: 'center',
              marginBottom: '32px'
            }}>
              <h2 style={{
                margin: 0,
                fontSize: '24px',
                fontWeight: '600',
                color: '#1d1d1f',
                marginBottom: '8px'
              }}>
                اختر نوع المستخدم
              </h2>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <button
                onClick={() => handleRoleSelect('admin')}
                style={{
                  padding: '16px 24px',
                  backgroundColor: brandConfig.themeColor || '#007aff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 122, 255, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <span>👤</span>
                <span>مدير | Admin</span>
              </button>

              <button
                onClick={() => handleRoleSelect('employee')}
                style={{
                  padding: '16px 24px',
                  backgroundColor: '#f5f5f7',
                  color: '#1d1d1f',
                  border: '2px solid #e5e5e7',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#e8e8ed';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#f5f5f7';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <span>👷</span>
                <span>موظف | Employee</span>
              </button>
            </div>
          </>
        ) : (
          // Admin Password Input
          <>
            <div style={{
              textAlign: 'center',
              marginBottom: '24px',
              position: 'relative'
            }}>
              <button
                onClick={handleBack}
                style={{
                  position: 'absolute',
                  top: '0',
                  right: '0',
                  background: 'transparent',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: '#666',
                  padding: '8px',
                  borderRadius: '8px',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '36px',
                  height: '36px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f5f5f7';
                  e.currentTarget.style.color = '#333';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#666';
                }}
                title="رجوع | Back"
              >
                ←
              </button>

              <h2 style={{
                margin: 0,
                fontSize: '24px',
                fontWeight: '600',
                color: '#1d1d1f',
                marginBottom: '8px'
              }}>
                كلمة مرور المدير
              </h2>
            </div>

            <form onSubmit={handleAdminSubmit}>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => {
                  setAdminPassword(e.target.value);
                  setPasswordError('');
                }}
                placeholder="أدخل كلمة المرور"
                autoFocus
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  fontSize: '16px',
                  border: passwordError ? '2px solid #ff3b30' : '2px solid #e5e5e7',
                  borderRadius: '12px',
                  marginBottom: passwordError ? '8px' : '16px',
                  outline: 'none',
                  transition: 'border-color 0.2s ease',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = brandConfig.themeColor || '#007aff';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#e5e5e7';
                }}
              />

              {passwordError && (
                <p style={{
                  color: '#ff3b30',
                  fontSize: '14px',
                  margin: '0 0 16px 0',
                  textAlign: 'right'
                }}>
                  {passwordError}
                </p>
              )}

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '14px 24px',
                  backgroundColor: isLoading ? '#ccc' : (brandConfig.themeColor || '#007aff'),
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 122, 255, 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {isLoading ? 'جاري التحقق...' : 'دخول | Login'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default RoleSelectionModal;

