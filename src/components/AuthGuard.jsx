import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FiShield, FiAlertTriangle, FiLogOut, FiRefreshCw } from 'react-icons/fi';

const AuthGuard = ({ children }) => {
  const { user, userRole, authError, businessIds, activeBusinessId, logout, loading } = useAuth();
  const location = useLocation();
  
  // Allow login page without authentication checks
  if (location.pathname === '/login') {
    return children;
  }

  // Show loading spinner while auth is initializing
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          padding: '32px',
          textAlign: 'center',
          maxWidth: '400px',
          width: '100%'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            backgroundColor: '#dbeafe',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px'
          }}>
            <FiRefreshCw style={{
              width: '32px',
              height: '32px',
              color: '#2563eb',
              animation: 'spin 1s linear infinite'
            }} />
          </div>
          <h2 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#111827',
            marginBottom: '8px'
          }}>جاري التحميل</h2>
          <p style={{
            color: '#6b7280',
            fontSize: '14px'
          }}>جاري تحميل البيانات...</p>
        </div>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Show error message if authentication failed
  if (authError) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #fef2f2 0%, #fce7f3 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}>
        <div style={{
          maxWidth: '500px',
          width: '100%',
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          padding: '32px',
          textAlign: 'center'
        }}>
          <div style={{ marginBottom: '32px' }}>
            <div style={{
              width: '80px',
              height: '80px',
              backgroundColor: '#fee2e2',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px'
            }}>
              <FiShield style={{
                width: '40px',
                height: '40px',
                color: '#dc2626'
              }} />
            </div>
            <h1 style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#111827',
              marginBottom: '16px'
            }}>
              مشكلة في الصلاحيات
            </h1>
            <div style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'right'
            }}>
              <p style={{
                color: '#374151',
                fontSize: '14px',
                lineHeight: '1.6',
                margin: 0
              }}>
                {authError}
              </p>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <button
              onClick={logout}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: 'white',
                padding: '12px 24px',
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                fontWeight: '500',
                fontSize: '16px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1)';
              }}
              onMouseOut={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
              }}
            >
              <FiLogOut style={{ width: '20px', height: '20px' }} />
              تسجيل الخروج
            </button>
            
            <button
              onClick={() => window.location.reload()}
              style={{
                width: '100%',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                padding: '12px 24px',
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                fontWeight: '500',
                fontSize: '16px',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.target.style.backgroundColor = '#e5e7eb';
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor = '#f3f4f6';
              }}
            >
              <FiRefreshCw style={{ width: '20px', height: '20px' }} />
              إعادة المحاولة
            </button>
          </div>
          
          <div style={{
            marginTop: '32px',
            paddingTop: '24px',
            borderTop: '1px solid #e5e7eb'
          }}>
            <p style={{
              fontSize: '14px',
              color: '#6b7280',
              margin: 0
            }}>
              إذا استمرت المشكلة، يرجى التواصل مع الإدارة
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show access denied if user has no valid role
  if (userRole === 'invalid') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-yellow-100 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white rounded-2xl shadow-2xl p-8 text-center">
          <div className="mb-8">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <FiAlertTriangle className="w-10 h-10 text-orange-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              لا يوجد صلاحية للوصول
            </h1>
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-right">
              <p className="text-gray-700 text-sm leading-relaxed">
                حسابك غير مُفعل أو لا يحتوي على الصلاحيات اللازمة للوصول إلى هذا النظام.
              </p>
            </div>
          </div>
          
          <div className="space-y-4">
            <button
              onClick={logout}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-6 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center justify-center gap-3 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              <FiLogOut className="w-5 h-5" />
              تسجيل الخروج
            </button>
          </div>
          
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              للحصول على الصلاحيات، يرجى التواصل مع الإدارة
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show business access mismatch if user is logged in but can't access current business
  if (user && businessIds.length > 0 && !businessIds.includes(activeBusinessId)) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}>
        <div style={{
          maxWidth: '500px',
          width: '100%',
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          padding: '32px',
          textAlign: 'center'
        }}>
          <div style={{ marginBottom: '32px' }}>
            <div style={{
              width: '80px',
              height: '80px',
              backgroundColor: '#fef3c7',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px'
            }}>
              <FiAlertTriangle style={{
                width: '40px',
                height: '40px',
                color: '#d97706'
              }} />
            </div>
            <h1 style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: '#111827',
              marginBottom: '16px'
            }}>
              خطأ في الوصول
            </h1>
            <div style={{
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '12px',
              padding: '16px',
              textAlign: 'right',
              marginBottom: '24px'
            }}>
              <p style={{
                color: '#374151',
                fontSize: '14px',
                lineHeight: '1.6',
                marginBottom: '16px'
              }}>
                أنت مسجل دخول بحساب مختلف. حسابك الحالي مُفعل للوصول إلى:
              </p>
              <div style={{
                backgroundColor: 'white',
                borderRadius: '8px',
                padding: '12px',
                border: '1px solid #f59e0b'
              }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {businessIds.map(businessId => (
                    <span key={businessId} style={{
                      display: 'inline-block',
                      backgroundColor: '#fef3c7',
                      color: '#92400e',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '500'
                    }}>
                      {businessId}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <button
              onClick={logout}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: 'white',
                padding: '12px 24px',
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                fontWeight: '500',
                fontSize: '16px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1)';
              }}
              onMouseOut={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)';
              }}
            >
              <FiLogOut style={{ width: '20px', height: '20px' }} />
              تسجيل الخروج وتسجيل الدخول بالحساب الصحيح
            </button>
            
            <button
              onClick={() => window.location.reload()}
              style={{
                width: '100%',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                padding: '12px 24px',
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                fontWeight: '500',
                fontSize: '16px',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.target.style.backgroundColor = '#e5e7eb';
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor = '#f3f4f6';
              }}
            >
              <FiRefreshCw style={{ width: '20px', height: '20px' }} />
              إعادة المحاولة
            </button>
          </div>
          
          <div style={{
            marginTop: '32px',
            paddingTop: '24px',
            borderTop: '1px solid #e5e7eb'
          }}>
            <p style={{
              fontSize: '14px',
              color: '#6b7280',
              margin: 0
            }}>
              تأكد من تسجيل الدخول بالحساب المناسب لهذا النظام
            </p>
          </div>
        </div>
      </div>
    );
  }

  // All checks passed, render the protected content
  return children;
};

export default AuthGuard;
