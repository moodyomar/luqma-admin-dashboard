import React from 'react';
import { useAuth } from '../src/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/firebaseConfig';
import { FiLogOut, FiUser, FiMail, FiPhone, FiCalendar } from 'react-icons/fi';

const DriverProfilePage = () => {
  const { user, userRole, activeBusinessId } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <div style={{
      padding: '20px',
      maxWidth: '600px',
      margin: '0 auto',
      minHeight: '100vh',
      paddingBottom: '100px' // Space for bottom nav
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '32px',
        padding: '0 4px'
      }}>
        <h1 style={{
          margin: 0,
          fontSize: '24px',
          fontWeight: '600',
          color: '#333'
        }}>
          الإعدادات
        </h1>
        <button
          onClick={handleLogout}
          style={{
            background: '#dc3545',
            border: 'none',
            color: '#fff',
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            fontSize: '20px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s'
          }}
          onMouseOver={e => (e.currentTarget.style.background = '#b71c1c')}
          onMouseOut={e => (e.currentTarget.style.background = '#dc3545')}
        >
          <FiLogOut />
        </button>
      </div>

      {/* Profile Card */}
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
        border: '1px solid #e5e5e7',
        marginBottom: '24px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px',
            color: 'white',
            marginLeft: '16px'
          }}>
            <FiUser />
          </div>
          <div>
            <h2 style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: '600',
              color: '#333',
              marginBottom: '4px'
            }}>
              {user?.displayName || 'سائق التوصيل'}
            </h2>
            <p style={{
              margin: 0,
              fontSize: '14px',
              color: '#666'
            }}>
              {userRole === 'driver' ? 'سائق توصيل' : 'مستخدم'}
            </p>
          </div>
        </div>

        {/* Profile Details */}
        <div style={{ space: '16px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 0',
            borderBottom: '1px solid #f0f0f0'
          }}>
            <FiMail style={{ marginLeft: '12px', color: '#666', fontSize: '18px' }} />
            <div>
              <div style={{ fontSize: '12px', color: '#999', marginBottom: '2px' }}>البريد الإلكتروني</div>
              <div style={{ fontSize: '16px', color: '#333' }}>{user?.email || 'غير محدد'}</div>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 0',
            borderBottom: '1px solid #f0f0f0'
          }}>
            <FiCalendar style={{ marginLeft: '12px', color: '#666', fontSize: '18px' }} />
            <div>
              <div style={{ fontSize: '12px', color: '#999', marginBottom: '2px' }}>تاريخ الانضمام</div>
              <div style={{ fontSize: '16px', color: '#333' }}>
                {user?.metadata?.creationTime ? 
                  new Date(user.metadata.creationTime).toLocaleDateString('ar-SA') : 
                  'غير محدد'
                }
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 0'
          }}>
            <FiUser style={{ marginLeft: '12px', color: '#666', fontSize: '18px' }} />
            <div>
              <div style={{ fontSize: '12px', color: '#999', marginBottom: '2px' }}>البزنس</div>
              <div style={{ fontSize: '16px', color: '#333' }}>{activeBusinessId || 'غير محدد'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
        border: '1px solid #e5e5e7'
      }}>
        <h3 style={{
          margin: '0 0 16px 0',
          fontSize: '18px',
          fontWeight: '600',
          color: '#333'
        }}>
          إجراءات سريعة
        </h3>
        
        <button
          onClick={() => navigate('/driver/orders')}
          style={{
            width: '100%',
            padding: '16px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            marginBottom: '12px',
            transition: 'transform 0.2s'
          }}
          onMouseOver={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
          onMouseOut={e => (e.currentTarget.style.transform = 'translateY(0)')}
        >
          عرض الطلبات
        </button>

        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            padding: '16px',
            background: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'background 0.2s'
          }}
          onMouseOver={e => (e.currentTarget.style.background = '#b71c1c')}
          onMouseOut={e => (e.currentTarget.style.background = '#dc3545')}
        >
          تسجيل خروج
        </button>
      </div>
    </div>
  );
};

export default DriverProfilePage;
