import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../../firebase/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

const BusinessSwitcher = () => {
  const { businessIds, activeBusinessId, switchBusiness, hasMultipleBusinesses } = useAuth();
  const [businessNames, setBusinessNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  // Fetch business names
  useEffect(() => {
    const fetchBusinessNames = async () => {
      const names = {};
      
      for (const businessId of businessIds) {
        try {
          const businessDoc = await getDoc(doc(db, 'menus', businessId));
          if (businessDoc.exists()) {
            const data = businessDoc.data();
            names[businessId] = data.name || data.businessName || businessId;
          } else {
            names[businessId] = businessId;
          }
        } catch (error) {
          console.error(`Error fetching business ${businessId}:`, error);
          names[businessId] = businessId;
        }
      }
      
      setBusinessNames(names);
      setLoading(false);
    };

    if (businessIds.length > 0) {
      fetchBusinessNames();
    }
  }, [businessIds]);

  // Don't show if user only has access to one business
  if (!hasMultipleBusinesses || loading) {
    return null;
  }

  const handleSwitch = (businessId) => {
    switchBusiness(businessId);
    setIsOpen(false);
  };

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: 1000
    }}>
      {/* Current Business Display */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          border: 'none',
          padding: '12px 20px',
          borderRadius: '25px',
          fontSize: '14px',
          fontWeight: 'bold',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          transition: 'all 0.3s ease'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        }}
      >
        <span>🏢</span>
        <span>{businessNames[activeBusinessId] || activeBusinessId}</span>
        <span style={{ fontSize: '10px' }}>{isOpen ? '▲' : '▼'}</span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '60px',
          right: '0',
          background: 'white',
          borderRadius: '15px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          padding: '10px',
          minWidth: '200px',
          maxHeight: '300px',
          overflowY: 'auto'
        }}>
          <div style={{
            padding: '10px 15px',
            fontSize: '12px',
            color: '#666',
            fontWeight: 'bold',
            borderBottom: '1px solid #eee',
            marginBottom: '5px'
          }}>
            اختر العمل
          </div>
          
          {businessIds.map((businessId) => (
            <button
              key={businessId}
              onClick={() => handleSwitch(businessId)}
              style={{
                width: '100%',
                padding: '12px 15px',
                border: 'none',
                background: businessId === activeBusinessId ? '#f0f0f0' : 'transparent',
                borderRadius: '10px',
                textAlign: 'right',
                cursor: 'pointer',
                fontSize: '14px',
                color: businessId === activeBusinessId ? '#667eea' : '#333',
                fontWeight: businessId === activeBusinessId ? 'bold' : 'normal',
                transition: 'all 0.2s ease',
                marginBottom: '5px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
              onMouseOver={(e) => {
                if (businessId !== activeBusinessId) {
                  e.currentTarget.style.background = '#f8f8f8';
                }
              }}
              onMouseOut={(e) => {
                if (businessId !== activeBusinessId) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              {businessId === activeBusinessId && <span>✓</span>}
              <span>{businessNames[businessId] || businessId}</span>
            </button>
          ))}
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: -1
          }}
        />
      )}
    </div>
  );
};

export default BusinessSwitcher;









