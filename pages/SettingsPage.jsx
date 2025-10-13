import React, { useState, useEffect } from 'react';
import { useAuth } from '../src/contexts/AuthContext';
import { FiSettings, FiUsers, FiHome, FiChevronRight } from 'react-icons/fi';
import BusinessManagePage from './BusinessManagePage';
import UserManagementPage from './UserManagementPage';
import './styles.css';

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState('business');
  const { userRole } = useAuth();

  const tabs = [
    {
      id: 'business',
      label: 'إعدادات العمل',
      icon: FiHome,
      component: BusinessManagePage
    },
    {
      id: 'users',
      label: 'إدارة السائقين',
      icon: FiUsers,
      component: UserManagementPage
    }
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component;

  if (userRole !== 'admin') {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#f8f9fa'
      }}>
        <div style={{
          textAlign: 'center',
          padding: '40px',
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
          maxWidth: '400px'
        }}>
          <FiSettings size={48} style={{ color: '#6c757d', marginBottom: '16px' }} />
          <h2 style={{ color: '#495057', marginBottom: '12px' }}>غير مصرح</h2>
          <p style={{ color: '#6c757d', margin: 0 }}>
            ليس لديك صلاحية للوصول إلى الإعدادات
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
    //   padding: window.innerWidth < 768 ? '8px' : '16px',
      paddingBottom: window.innerWidth < 768 ? '50px' : '16px', 
      backgroundColor: '#f8f9fa',
      minHeight: '100vh'
    }}>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '8px',
        marginTop: '24px',
        marginBottom: '24px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        border: '1px solid #e9ecef',
        overflow: 'hidden'
      }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px 20px',
                border: 'none',
                backgroundColor: isActive ? '#007AFF' : 'transparent',
                color: isActive ? '#fff' : '#6c757d',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: 'system-ui',
                fontSize: '16px',
                fontWeight: isActive ? '600' : '500',
                gap: '8px'
              }}
            >
              <Icon size={20} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        border: '1px solid #e9ecef',
        overflow: 'hidden'
      }}>
        {ActiveComponent && <ActiveComponent />}
      </div>
    </div>
  );
};

export default SettingsPage;
