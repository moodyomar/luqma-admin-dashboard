import React, { useState, useEffect } from 'react';
import { db } from '../../firebase/firebaseConfig';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { FiBell, FiX, FiCheck, FiClock, FiShoppingBag } from 'react-icons/fi';

const NotificationSystem = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const { activeBusinessId, userRole } = useAuth();

  useEffect(() => {
    if (!activeBusinessId) return;

    // Listen for new orders - using correct Firestore path
    const ordersQuery = query(
      collection(db, 'menus', activeBusinessId, 'orders'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(ordersQuery, (snapshot) => {
      const newNotifications = [];
      let count = 0;

      snapshot.docs.forEach((doc) => {
        const order = { id: doc.id, ...doc.data() };
        
        // Only show notifications for recent orders (last 30 minutes)
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        const orderTime = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
        
        if (orderTime && orderTime > thirtyMinutesAgo) {
          const isNewOrder = order.status === 'pending' || order.status === 'confirmed';
          
          if (isNewOrder) {
            // Create clean, modern notification messages like popular apps
            const customerName = order.customerName || order.customer?.name || order.name || 'عميل';
            const orderTotal = order.totalAmount || order.total || order.amount || 0;
            
            // Extract first meal name from order
            let firstMealName = '';
            if (order.cart && Array.isArray(order.cart) && order.cart.length > 0) {
              const firstItem = order.cart[0];
              firstMealName = firstItem.name?.ar || firstItem.name?.en || firstItem.name || firstItem.title || firstItem.productName || firstItem.mealName || '';
            } else if (order.items && Array.isArray(order.items) && order.items.length > 0) {
              const firstItem = order.items[0];
              firstMealName = firstItem.name?.ar || firstItem.name?.en || firstItem.name || firstItem.title || firstItem.productName || firstItem.mealName || '';
            } else if (order.orderItems && Array.isArray(order.orderItems) && order.orderItems.length > 0) {
              const firstItem = order.orderItems[0];
              firstMealName = firstItem.name?.ar || firstItem.name?.en || firstItem.name || firstItem.title || firstItem.productName || firstItem.mealName || '';
            } else if (order.products && Array.isArray(order.products) && order.products.length > 0) {
              const firstItem = order.products[0];
              firstMealName = firstItem.name?.ar || firstItem.name?.en || firstItem.name || firstItem.title || firstItem.productName || firstItem.mealName || '';
            } else if (order.meals && Array.isArray(order.meals) && order.meals.length > 0) {
              const firstItem = order.meals[0];
              firstMealName = firstItem.name?.ar || firstItem.name?.en || firstItem.name || firstItem.title || firstItem.productName || firstItem.mealName || '';
            }
            
            // Create varied, modern notification messages
            const notificationTitles = [
              'طلب جديد 🍽️',
              'طلب وصول 🎉',
              'طلب جديد 📱',
              'طلب استلام 🛒'
            ];
            
            const randomIndex = Math.floor(Math.random() * notificationTitles.length);
            const title = notificationTitles[randomIndex];
            
            // Create message with meal name if available
            let message = '';
            if (firstMealName) {
              message = `${customerName} - ${firstMealName}`;
            } else {
              // Fallback if no meal name found
              message = orderTotal > 0 
                ? `${customerName} - ${orderTotal}₪`
                : customerName;
            }
            
            newNotifications.push({
              id: `order-${order.id}`,
              type: 'new_order',
              title: title,
              message: message,
              timestamp: orderTime,
              orderId: order.id,
              read: false,
              icon: FiShoppingBag
            });
            count++;
          }
        }
      });

      setNotifications(newNotifications);
      setUnreadCount(count);
    });

    return () => unsubscribe();
  }, [activeBusinessId]);

  const markAsRead = (notificationId) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === notificationId ? { ...notif, read: true } : notif
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notif => ({ ...notif, read: true }))
    );
    setUnreadCount(0);
  };

  const clearAll = () => {
    setNotifications([]);
    setUnreadCount(0);
  };

  const formatTime = (timestamp) => {
    const now = new Date();
    const orderTime = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    const diff = now - orderTime;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'الآن';
    if (minutes < 60) return `منذ ${minutes} دقيقة`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `منذ ${hours} ساعة`;
    return orderTime.toLocaleDateString('ar-SA');
  };

  // Don't show notifications for drivers
  if (userRole === 'driver') {
    return null;
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Notification Bell */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        style={{
          position: 'relative',
          background: 'none',
          border: 'none',
          color: '#666',
          cursor: 'pointer',
          padding: '12px',
          borderRadius: '50%',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onMouseOver={(e) => {
          e.target.style.backgroundColor = '#f5f5f5';
          e.target.style.color = '#007AFF';
        }}
        onMouseOut={(e) => {
          e.target.style.backgroundColor = 'transparent';
          e.target.style.color = '#666';
        }}
      >
        <FiBell size={24} />
        {unreadCount > 0 && (
          <div style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            backgroundColor: '#FF3B30',
            color: 'white',
            borderRadius: '50%',
            width: '18px',
            height: '18px',
            fontSize: '10px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'system-ui'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <>
          {/* Backdrop */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 998
            }}
            onClick={() => setShowDropdown(false)}
          />
          
          {/* Dropdown Content */}
          <div style={{
            position: 'fixed',
            top: '70px',
            right: '16px',
            width: '300px',
            maxHeight: '400px',
            backgroundColor: 'white',
            border: '1px solid #e5e5e7',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
            zIndex: 999,
            overflow: 'hidden'
          }}>
            
            {/* Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e5e5e7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h3 style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: '600',
                color: '#1d1d1f',
                fontFamily: 'system-ui'
              }}>
                الإشعارات
              </h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#007AFF',
                      cursor: 'pointer',
                      fontSize: '12px',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseOver={(e) => {
                      e.target.style.backgroundColor = 'rgba(0, 122, 255, 0.1)';
                    }}
                    onMouseOut={(e) => {
                      e.target.style.backgroundColor = 'transparent';
                    }}
                  >
                    قراءة الكل
                  </button>
                )}
                <button
                  onClick={clearAll}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#FF3B30',
                    cursor: 'pointer',
                    fontSize: '12px',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => {
                    e.target.style.backgroundColor = 'rgba(255, 59, 48, 0.1)';
                  }}
                  onMouseOut={(e) => {
                    e.target.style.backgroundColor = 'transparent';
                  }}
                >
                  مسح الكل
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div style={{
              maxHeight: '300px',
              overflowY: 'auto'
            }}>
              {notifications.length === 0 ? (
                <div style={{
                  padding: '32px 20px',
                  textAlign: 'center',
                  color: '#8E8E93'
                }}>
                  <FiBell size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
                  <p style={{ margin: 0, fontSize: '14px' }}>
                    لا توجد إشعارات جديدة
                  </p>
                </div>
              ) : (
                notifications.map((notification) => {
                  const Icon = notification.icon;
                  return (
                    <div
                      key={notification.id}
                      style={{
                        padding: '12px 20px',
                        borderBottom: '1px solid #f5f5f5',
                        backgroundColor: notification.read ? 'transparent' : 'rgba(0, 122, 255, 0.05)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px'
                      }}
                      onMouseOver={(e) => {
                        e.target.style.backgroundColor = notification.read ? '#f5f5f5' : 'rgba(0, 122, 255, 0.1)';
                      }}
                      onMouseOut={(e) => {
                        e.target.style.backgroundColor = notification.read ? 'transparent' : 'rgba(0, 122, 255, 0.05)';
                      }}
                      onClick={() => markAsRead(notification.id)}
                    >
                      <div style={{
                        color: '#007AFF',
                        marginTop: '2px',
                        flexShrink: 0
                      }}>
                        <Icon size={16} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: notification.read ? '400' : '600',
                          color: '#1d1d1f',
                          marginBottom: '2px',
                          fontFamily: 'system-ui'
                        }}>
                          {notification.title}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: '#666',
                          lineHeight: '1.4',
                          marginBottom: '4px'
                        }}>
                          {notification.message}
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: '#8E8E93'
                        }}>
                          {formatTime(notification.timestamp)}
                        </div>
                      </div>
                      {!notification.read && (
                        <div style={{
                          width: '8px',
                          height: '8px',
                          backgroundColor: '#007AFF',
                          borderRadius: '50%',
                          marginTop: '6px',
                          flexShrink: 0
                        }} />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationSystem;
