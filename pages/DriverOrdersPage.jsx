import React, { useEffect, useState, useMemo, useRef } from 'react';
import brandConfig from '../constants/brandConfig';
import { db } from '../firebase/firebaseConfig';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../src/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/firebaseConfig';
import { IoMdCheckmark, IoMdClose, IoMdBicycle } from 'react-icons/io';
import { FiLogOut, FiClock, FiPackage, FiCheckCircle } from 'react-icons/fi';
import NotificationSystem from '../src/components/NotificationSystem';
import './styles.css';

// Helper function to check if an order is a future/scheduled order
const isFutureOrder = (order) => {
  if (!order.deliveryDateTime) return false;
  if (order.status !== 'pending') return false; // Only pending orders can be future orders
  
  try {
    // Handle Firestore Timestamp
    let scheduledTime;
    if (order.deliveryDateTime?.toDate && typeof order.deliveryDateTime.toDate === 'function') {
      scheduledTime = order.deliveryDateTime.toDate();
    } else if (order.deliveryDateTime instanceof Date) {
      scheduledTime = order.deliveryDateTime;
    } else {
      scheduledTime = new Date(order.deliveryDateTime);
    }
    
    if (isNaN(scheduledTime.getTime())) return false;
    
    const now = new Date();
    return scheduledTime > now;
  } catch (error) {
    console.warn('Error checking future order:', error);
    return false;
  }
};

const DriverOrderCard = React.memo(({ order, activeBusinessId, orderTimers }) => {
  const [loading, setLoading] = useState(false);

  const deliveryString = order.deliveryMethod === 'delivery' ? 'توصيل للبيت' : 
                        order.deliveryMethod === 'eat_in' ? 'اكل بالمطعم' : 'استلام بالمحل';
  const paymentString = order.paymentMethod === 'cash' ? 'كاش' : 'اونلاين';

  // Format date in English/Israel format
  let formattedDate = '';
  if (order.date) {
    const dateObj = new Date(order.date);
    if (!isNaN(dateObj)) {
      formattedDate = dateObj.toLocaleDateString('en-IL', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } else {
      formattedDate = order.date;
    }
  }

  // Mark order as out for delivery
  const handleOutForDelivery = async () => {
    setLoading(true);
    try {
      const orderId = order.id || order.uid;
      if (!orderId) {
        throw new Error('Order ID is missing');
      }
      const ref = doc(db, 'menus', activeBusinessId, 'orders', orderId);
      await updateDoc(ref, {
        status: 'out_for_delivery',
        outForDeliveryAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error updating order:', err);
      alert('خطأ في تحديث الطلب: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Mark order as delivered
  const handleDelivered = async () => {
    setLoading(true);
    try {
      const orderId = order.id || order.uid;
      if (!orderId) {
        throw new Error('Order ID is missing');
      }
      const ref = doc(db, 'menus', activeBusinessId, 'orders', orderId);
      await updateDoc(ref, {
        status: 'delivered',
        deliveredAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error updating order:', err);
      alert('خطأ في تحديث الطلب: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="order-card">
      <div className="order-header">
        <div className="dateCol">
          <span className="order-date">{formattedDate}</span>
          <span className="order-id">#{(order.uid || order.id)?.slice(0, 6)}</span>
        </div>
        <div className="status-badge" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 38,
          height: 38,
          padding: '0 20px',
          borderRadius: '20px',
          fontSize: '18px',
          fontWeight: '600',
          color: '#fff',
          background: 
            order.status === 'ready' ? '#28a745' :
            order.status === 'out_for_delivery' ? '#ffc107' :
            order.status === 'delivered' || order.status === 'completed' || order.status === 'served' ? '#34C759' :
            '#007bff'
        }}>
          {order.status === 'ready' ? 'جاهز' :
           order.status === 'out_for_delivery' ? (order.deliveryMethod === 'delivery' ? 'قيد التوصيل' : 'قيد الاستلام') :
           order.status === 'delivered' || order.status === 'completed' || order.status === 'served' ? (order.deliveryMethod === 'delivery' ? 'تم التوصيل' : 'تم الاستلام') :
           'قيد التحضير'}
        </div>
      </div>

      {/* Restaurant Estimated Prep Time - Countdown Timer */}
      {order.status === 'preparing' && orderTimers && orderTimers[order.id || order.uid] !== undefined && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '10px 14px',
          marginTop: '12px',
          background: orderTimers[order.id || order.uid] <= 0
            ? 'linear-gradient(135deg, #c8e6c9 0%, #81c784 100%)'
            : orderTimers[order.id || order.uid] <= 300 
              ? 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)' 
              : 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
          borderRadius: '8px',
          border: orderTimers[order.id || order.uid] <= 0
            ? '2px solid #4caf50'
            : orderTimers[order.id || order.uid] <= 300 
              ? '1px solid #ef5350' 
              : '1px solid #90caf9',
          animation: orderTimers[order.id || order.uid] <= 0 ? 'pulse 1.5s infinite' : 'none'
        }}>
          {orderTimers[order.id || order.uid] <= 0 ? (
            <>
              <span style={{ fontSize: '18px', marginLeft: '8px' }}>✅</span>
              <span style={{ 
                fontSize: '15px', 
                fontWeight: '700', 
                color: '#2e7d32'
              }}>
                الوجبة جاهزة الآن! 🎉
              </span>
            </>
          ) : (
            <>
              <span style={{ fontSize: '16px', marginLeft: '6px' }}>⏱️</span>
              <span style={{ 
                fontSize: '14px', 
                fontWeight: '600', 
                color: orderTimers[order.id || order.uid] <= 300 ? '#c62828' : '#1976d2'
              }}>
                وقت متبقي: {Math.floor(orderTimers[order.id || order.uid] / 60)}:{String(orderTimers[order.id || order.uid] % 60).padStart(2, '0')} دقيقة
              </span>
            </>
          )}
        </div>
      )}

      <div className="row">
        <div>
          <span className="label">👤</span>
          <span className="value">{order.name || '—'}</span>
        </div>
        <div>
          <span className="label">📞</span>
          <span className="value">{order.phone || '—'}</span>
        </div>
      </div>


      <div className="row">
        <div>
          <span className="label">📦 عدد المنتجات:</span>
          <span className="value">{order.cart?.length || 0}</span>
        </div>
        <div>
          <span className="label">💰 السعر:</span>
          <span className="value order-price">₪{order.total || order.price}</span>
        </div>
      </div>
      <p>
        <span className="label">📍 العنوان:</span>
        <span className="value">{order.address || '—'}</span>
      </p>

      {order.cart?.length > 0 && (
        <div className="order-meals">
          <p className="meals-title">تفاصيل الوجبات:</p>
          <ul>
            {order.cart.map((item, index) => (
              <li key={item.uid || `${item.id}-${index}`} className="meal-item" style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                {item.image && (
                  <img
                    src={item.image}
                    alt="meal"
                    className="meal-image"
                    loading="lazy"
                  />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>
                    {item.name?.ar || item.name} × {item.quantity}
                    {item.optionsText && <span style={{ color: '#666' }}> – {item.optionsText}</span>}
                  </div>
                  {Array.isArray(item.selectedExtras) && item.selectedExtras.length > 0 && (
                    <div style={{ fontSize: 13, color: '#999' }}>
                      إضافات:{' '}
                      {item.selectedExtras
                        .map(extra => {
                          if (typeof extra === 'object') {
                            return extra.label?.ar || extra.label || '';
                          }
                          return '';
                        })
                        .filter(Boolean)
                        .join('، ')}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {order.note && (
        <div style={{ marginTop: 20, padding: 12, background: '#f9f9f9', borderRadius: 6 }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>📌 ملاحظة الزبون:</p>
          <p style={{ margin: 0, color: '#444' }}>{order.note}</p>
        </div>
      )}

      {/* Driver-specific action buttons */}
      {order.status === 'ready' && (
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
          <button 
            onClick={handleOutForDelivery} 
            disabled={loading} 
            style={{ 
              fontWeight: 700, 
              padding: '10px 28px', 
              borderRadius: 8, 
              background: '#FF9500', 
              color: '#fff', 
              border: 'none', 
              cursor: 'pointer', 
              fontSize: 18, 
              display: 'flex', 
              alignItems: 'center' 
            }}
          >
            <IoMdBicycle style={{ marginLeft: 8 }} />
            {order.deliveryMethod === 'delivery' ? 'بدء التوصيل' : 'بدء الاستلام'}
          </button>
        </div>
      )}

      {order.status === 'out_for_delivery' && (
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
          <button 
            onClick={handleDelivered} 
            disabled={loading} 
            style={{ 
              fontWeight: 700, 
              padding: '10px 28px', 
              borderRadius: 8, 
              background: '#34C759', 
              color: '#fff', 
              border: 'none', 
              cursor: 'pointer', 
              fontSize: 18, 
              display: 'flex', 
              alignItems: 'center' 
            }}
          >
            <IoMdCheckmark style={{ marginLeft: 8 }} />
            {order.deliveryMethod === 'delivery' ? 'تم التوصيل' : 'تم الاستلام'}
          </button>
        </div>
      )}
    </div>
  );
});

const DriverOrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const { user, activeBusinessId } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [orderTimers, setOrderTimers] = useState({}); // Track countdown timers for each order

  useEffect(() => {
    if (!activeBusinessId) return;
    
    const unsubscribe = onSnapshot(
      collection(db, 'menus', activeBusinessId, 'orders'), 
      (snapshot) => {
        const updatedOrders = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        
        // Debug logging
        console.log('🚚 Driver Orders Debug:', {
          totalOrders: updatedOrders.length,
          deliveryOrders: updatedOrders.filter(o => o.deliveryMethod === 'delivery').length,
          ordersByStatus: updatedOrders.reduce((acc, order) => {
            acc[order.status] = (acc[order.status] || 0) + 1;
            return acc;
          }, {}),
          ordersByDeliveryMethod: updatedOrders.reduce((acc, order) => {
            acc[order.deliveryMethod] = (acc[order.deliveryMethod] || 0) + 1;
            return acc;
          }, {}),
          sampleOrders: updatedOrders.slice(0, 3).map(o => ({
            id: o.id,
            status: o.status,
            deliveryMethod: o.deliveryMethod,
            customerName: o.customerName || o.name
          }))
        });
        
        setOrders(updatedOrders);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [activeBusinessId]);

  // Timer countdown - update every second
  useEffect(() => {
    const interval = setInterval(() => {
      setOrderTimers(prevTimers => {
        const newTimers = { ...prevTimers };
        Object.keys(newTimers).forEach(orderId => {
          if (newTimers[orderId] > 0) {
            newTimers[orderId] = newTimers[orderId] - 1;
          } else {
            delete newTimers[orderId]; // Remove completed timers
          }
        });
        return newTimers;
      });
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, []);

  // Initialize timers for orders that are preparing
  useEffect(() => {
    const newTimers = {};
    const now = new Date();
    
    orders.forEach(order => {
      const orderId = order.id || order.uid;
      
      // Only start timer for orders that are preparing and don't already have a timer
      if (order.status === 'preparing' && !orderTimers[orderId]) {
        // Use the prep time that was set when order was accepted
        let prepTimeMinutes = order.prepTimeMinutes || 15; // default 15 minutes if not set
        
        // Calculate actual remaining time based on when order was accepted
        let remainingSeconds = prepTimeMinutes * 60;
        
        // If we have acceptedAt timestamp, calculate elapsed time
        if (order.acceptedAt || order.preparingStartedAt) {
          const startTime = new Date(order.acceptedAt || order.preparingStartedAt);
          const elapsedSeconds = Math.floor((now - startTime) / 1000);
          remainingSeconds = Math.max(0, (prepTimeMinutes * 60) - elapsedSeconds);
        }
        
        newTimers[orderId] = remainingSeconds;
      }
    });
    
    if (Object.keys(newTimers).length > 0) {
      setOrderTimers(prev => ({ ...prev, ...newTimers }));
    }
  }, [orders]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const sortedOrders = useMemo(() => {
    // Filter out future orders - drivers shouldn't see scheduled orders until they're due
    const regularOrders = orders.filter(order => !isFutureOrder(order));
    
    return regularOrders.sort((a, b) => {
      // Status priority for drivers (lower number = higher priority = shown first)
      const statusPriority = {
        'ready': 1,            // Ready for pickup - HIGHEST PRIORITY
        'preparing': 2,        // Being prepared - driver can wait
        'out_for_delivery': 3, // Already with driver - lower priority
        'delivered': 4,
        'completed': 4,
        'served': 4,
      };
      
      const priorityA = statusPriority[a.status] || 999;
      const priorityB = statusPriority[b.status] || 999;
      
      // If same status, sort by newest first
      if (priorityA === priorityB) {
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
      
      return priorityA - priorityB;
    });
  }, [orders]);

  // Calculate driver-specific stats (only delivery orders, exclude future orders)
  const driverStats = useMemo(() => {
    const deliveryOrders = orders.filter(order => 
      order.deliveryMethod === 'delivery' && !isFutureOrder(order)
    );
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayOrders = deliveryOrders.filter(order => {
      const orderDate = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
      return orderDate >= today && orderDate < tomorrow;
    });
    
    const activeOrders = deliveryOrders.filter(order => 
      ['preparing', 'ready', 'out_for_delivery'].includes(order.status)
    );
    
    const completedOrders = deliveryOrders.filter(order => 
      ['delivered', 'completed', 'served'].includes(order.status)
    );
    
    const totalRevenue = completedOrders.reduce((sum, order) => 
      sum + parseFloat(order.totalAmount || order.total || 0), 0
    );
    
    return {
      todayOrders: todayOrders.length,
      activeOrders: activeOrders.length,
      completedOrders: completedOrders.length,
      totalRevenue: totalRevenue
    };
  }, [orders]);

  // Tab configs: Drivers only see orders after restaurant accepts them (preparing onwards)
  const tabConfigs = [
    {
      label: 'قيد التحضير',
      icon: FiPackage,
      filter: (order) => order.deliveryMethod === 'delivery' && order.status === 'preparing',
      badgeCount: sortedOrders.filter(order => order.deliveryMethod === 'delivery' && order.status === 'preparing').length,
    },
    {
      label: 'جاهز',
      icon: IoMdBicycle,
      filter: (order) => order.deliveryMethod === 'delivery' && order.status === 'ready',
      badgeCount: sortedOrders.filter(order => order.deliveryMethod === 'delivery' && order.status === 'ready').length,
      highlight: true, // Add special styling to make it stand out
    },
    {
      label: 'قيد التوصيل',
      icon: FiClock,
      filter: (order) => order.deliveryMethod === 'delivery' && order.status === 'out_for_delivery',
      badgeCount: sortedOrders.filter(order => order.deliveryMethod === 'delivery' && order.status === 'out_for_delivery').length,
    },
    {
      label: 'سابقة',
      icon: FiCheckCircle,
      filter: (order) => order.deliveryMethod === 'delivery' && ['delivered', 'completed', 'served'].includes(order.status),
      badgeCount: 0,
    },
  ];

  const filteredOrders = sortedOrders.filter(tabConfigs[tab].filter);

  return (
    <div className="orders-container" style={{ paddingBottom: 80 }}>
      {/* Notification System */}
      <NotificationSystem />
      {/* Top bar actions: title + settings (left) + logout (right) */}
      <div style={{ position: 'fixed', top: 16, left: 16, zIndex: 210 }}>
        <button
          onClick={() => navigate('/driver/profile')}
          style={{
            background: '#f2f2f7',
            border: '1px solid #e5e5e7',
            color: '#1d1d1f',
            width: 44,
            height: 44,
            borderRadius: 10,
            fontSize: 20,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
          }}
          title="الإعدادات"
          aria-label="الإعدادات"
        >
          ⚙️
        </button>
      </div>

      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 20,
        padding: '0 20px'
      }}>
        <h1 className="orders-title" style={{ margin: 0, textAlign: 'center',width: '100%' }}>
          لوحة السائق
        </h1>
        <button
          onClick={handleLogout}
          style={{
            position: 'fixed',
            top: 24,
            right: 32,
            background: '#dc3545',
            border: 'none',
            color: '#fff',
            width: 44,
            height: 44,
            borderRadius: 10,
            fontSize: 26,
            cursor: 'pointer',
            zIndex: 200,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s',
          }}
          title="تسجيل خروج"
          aria-label="تسجيل خروج"
          onMouseOver={e => (e.currentTarget.style.background = '#b71c1c')}
          onMouseOut={e => (e.currentTarget.style.background = '#dc3545')}
        >
          <FiLogOut />
        </button>
      </div>

      {/* Driver Dashboard Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '16px',
        padding: '0 20px',
        marginBottom: '24px'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '16px 18px',
          borderRadius: '12px',
          color: 'white',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <div style={{ fontSize: '26px', marginBottom: '6px' }}>📦</div>
          <div style={{ fontSize: '11px', opacity: 0.9, marginBottom: '4px' }}>طلبات اليوم</div>
          <div style={{ fontSize: '19px', fontWeight: 'bold' }}>
            {driverStats.todayOrders}
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          padding: '16px 18px',
          borderRadius: '12px',
          color: 'white',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <div style={{ fontSize: '26px', marginBottom: '6px' }}>🚚</div>
          <div style={{ fontSize: '11px', opacity: 0.9, marginBottom: '4px' }}>طلبات نشطة</div>
          <div style={{ fontSize: '19px', fontWeight: 'bold' }}>
            {driverStats.activeOrders}
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
          padding: '16px 18px',
          borderRadius: '12px',
          color: 'white',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <div style={{ fontSize: '26px', marginBottom: '6px' }}>✅</div>
          <div style={{ fontSize: '11px', opacity: 0.9, marginBottom: '4px' }}>مكتملة</div>
          <div style={{ fontSize: '19px', fontWeight: 'bold' }}>
            {driverStats.completedOrders}
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
          padding: '16px 18px',
          borderRadius: '12px',
          color: 'white',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center'
        }}>
          <div style={{ fontSize: '26px', marginBottom: '6px' }}>💰</div>
          <div style={{ fontSize: '11px', opacity: 0.9, marginBottom: '4px' }}>إجمالي المبيعات</div>
          <div style={{ fontSize: '19px', fontWeight: 'bold' }}>
            {driverStats.totalRevenue.toLocaleString()}₪
          </div>
        </div>
      </div>

      {/* Sticky bottom status bar */}
      <div style={{ height: 60 }} />
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '8px 16px',
        background: '#fff',
        borderTop: '1px solid #e5e5e7',
        display: 'flex',
        justifyContent: 'center',
        gap: 8,
        zIndex: 1100,
        boxShadow: '0 -4px 16px rgba(0,0,0,0.08)'
      }}>
        {tabConfigs.map((tabConfig, idx) => {
          const IconComponent = tabConfig.icon;
          const isHighlightTab = tabConfig.highlight && tabConfig.badgeCount > 0;
          return (
            <button
              key={tabConfig.label}
              onClick={() => setTab(idx)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: 20,
                border: isHighlightTab && idx !== tab ? '2px solid #28a745' : 'none',
                background: idx === tab ? (isHighlightTab ? '#28a745' : '#007AFF') : (isHighlightTab ? 'rgba(40, 167, 69, 0.1)' : 'transparent'),
                color: idx === tab ? '#fff' : (isHighlightTab ? '#28a745' : '#8E8E93'),
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                minWidth: '80px',
                position: 'relative',
                transition: 'all 0.2s ease',
                boxShadow: isHighlightTab && idx !== tab ? '0 2px 8px rgba(40, 167, 69, 0.2)' : 'none'
              }}
            >
              <IconComponent size={16} style={{ strokeWidth: isHighlightTab ? 2.5 : 2 }} />
              <span style={{ whiteSpace: 'nowrap' }}>{tabConfig.label}</span>
              {tabConfig.badgeCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-2px',
                  right: '-2px',
                  minWidth: 18,
                  height: 18,
                  borderRadius: 9,
                  background: '#FF3B30', // Always red for high visibility
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #fff',
                  boxShadow: '0 2px 4px rgba(255, 59, 48, 0.3)'
                }}>
                  {tabConfig.badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          جاري تحميل الطلبات...
        </div>
      ) : filteredOrders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📦</div>
          <p style={{ margin: 0, fontSize: '16px' }}>لا توجد {tabConfigs[tab].label} حالياً</p>
          <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#999' }}>
            إجمالي الطلبات: {orders.length} | طلبات التوصيل: {orders.filter(o => o.deliveryMethod === 'delivery').length}
          </p>
        </div>
      ) : (
        <div className="orders-grid">
          {filteredOrders.map((order) => (
            <DriverOrderCard key={order.uid || order.id} order={order} activeBusinessId={activeBusinessId} orderTimers={orderTimers} />
          ))}
        </div>
      )}

    </div>
  );
};

export default DriverOrdersPage; 